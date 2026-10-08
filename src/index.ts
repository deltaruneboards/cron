export default {
	async scheduled(event, env, ctx): Promise<void> {
		const [response, monitoringData] = await Promise.all([
			fetch('https://deltaruneboards.net/cron.php', {
				headers: {
					'X-CF-Worker': env.CRON_KEY,
				}
			}),
			env.KV.get('monitoring'),
		]);
		const monitoring = JSON.parse(monitoringData || '{}');
		if (!response.ok) {
			const text = await response.text();
			console.error({
				message: 'cron.php responded with error',
				status: response.status,
				headers: response.headers,
				text,
			});
		} else {
			const json: any = await response.json();
			console.info({
				message: 'successful cron invocation',
				...json,
			});
		}
		// await env.KV.put('monitoring', JSON.stringify(monitoring));
	},
} satisfies ExportedHandler<Env>;
