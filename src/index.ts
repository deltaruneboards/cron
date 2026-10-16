import {monitoring} from './monitoring';

export default {
	async scheduled(event, env, ctx): Promise<void> {
		const [response, monitoringDataString] = await Promise.all([
			fetch('https://deltaruneboards.net/cron.php', {
				headers: {
					'X-CF-Worker': env.CRON_KEY,
				}
			}),
			env.KV.get('monitoring'),
		]);
		const monitoringData = JSON.parse(monitoringDataString || '{}');
		if (!response.ok) {
			const text = await response.text();
			console.error({
				message: 'cron.php responded with error',
				status: response.status,
				headers: response.headers,
				text,
			});
			await monitoring(env, monitoringData, {
				error: true,
			});
		} else {
			try {
				const json: any = await response.json();
				console.info({
					message: 'successful cron invocation',
					...json,
				});
				await monitoring(env, monitoringData, json);
			} catch (error) {
				console.error({
					message: 'failed to parse cron.php response',
					error,
				});
				await monitoring(env, monitoringData, {
					error: true,
				});
			}
		}
	},
} satisfies ExportedHandler<Env>;
