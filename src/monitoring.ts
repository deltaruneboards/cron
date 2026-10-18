type MonitoringData = Record<string, {
	raised: boolean;
	times: number[];
} | undefined>;

type CronResponse = {
	error: true;
} | {
	error: false;
	done: number;
	failed: number;
	overtime: true;
} | {
	error: false;
	done: number;
	failed: number;
	overtime: false;
	load1: number;
	load5: number;
	load15: number;
};

interface Metric {
	shouldAlert: (res: CronResponse) => boolean,
	thresholdTimes: number;
	thresholdRuns: number;
	raisedMessage: string;
	resolvedMessage: string;
}

const METRICS: Record<string, Metric> = {
	errors: {
		shouldAlert: res => res.error,
		thresholdTimes: 3,
		thresholdRuns: 5,
		raisedMessage: 'cron experienced failure 3 times in the last 5 runs, check [error log](<https://deltaruneboards.net/index.php?action=admin;area=logs;sa=errorlog;desc=>) and whether the site is still accessible',
		resolvedMessage: 'cron is no longer experiencing failures',
	},
	overtime: {
		shouldAlert: res => !res.error && res.overtime,
		thresholdTimes: 10,
		thresholdRuns: 20,
		raisedMessage: 'cron has run overtime 10 times in the last 20 minutes, the background task queue might be currently under pressure',
		resolvedMessage: 'cron is no longer running overtime',
	},
	failed: {
		shouldAlert: res => !res.error && res.failed > 0,
		thresholdTimes: 5,
		thresholdRuns: 10,
		raisedMessage: 'there seems to be a large amount of failed tasks in the last 10 minutes, check [error log](<https://deltaruneboards.net/index.php?action=admin;area=logs;sa=errorlog;desc=>)',
		resolvedMessage: 'background tasks seem to have stopped failing',
	},
	load: {
		shouldAlert: res => !res.error && !res.overtime && res.load1 > 8,
		thresholdTimes: 3,
		thresholdRuns: 5,
		raisedMessage: 'the server seems to be under load',
		resolvedMessage: 'the server seems to no longer be under load',
	},
};

export async function monitoring(
	env: Env,
	monitoringData: MonitoringData,
	response: CronResponse,
): Promise<void> {
	const now = Date.now();
	const messagesToSend: string[] = [];
	let anyAlerts = false;
	for (const [metricName, metric] of Object.entries(METRICS)) {
		const metricData = monitoringData[metricName] ?? {
			raised: false,
			times: [],
		};
		const relevantTimes = metricData.times
			.filter(t => t > now - metric.thresholdRuns * 60 * 1000 - 50 * 1000);
		const shouldAlert = metric.shouldAlert(response);
		if (shouldAlert) {
			relevantTimes.push(now);
			anyAlerts = true;
		}
		const shouldBeRaised = relevantTimes.length >= metric.thresholdTimes;
		if (metricData.raised && !shouldBeRaised) {
			messagesToSend.push(metric.resolvedMessage);
		} else if (!metricData.raised && shouldBeRaised) {
			messagesToSend.push(`<@&1556793816621645904> ${metric.raisedMessage}`);
		}
		monitoringData[metricName] = {
			raised: shouldBeRaised,
			times: relevantTimes,
		};
	}
	if (anyAlerts || messagesToSend.length > 0) {
		console.info({
			message: 'updating monitoring data',
			monitoringData,
		});
		await env.KV.put('monitoring', JSON.stringify(monitoringData));
	}
	if (messagesToSend.length > 0) {
		const webhookResponse = await fetch(env.MONITORING_WEBHOOK, {
			body: JSON.stringify({
				content: messagesToSend.length > 1 ?
					messagesToSend.map(m => `- ${m}`).join('\n') :
					messagesToSend[0],
			}),
			headers: {
				'Content-Type': 'application/json'
			},
			method: 'POST',
		});
		if (!webhookResponse.ok) {
			console.error({
				message: 'failed to send Discord webhook',
				status: webhookResponse.status,
			});
		}
	}
}
