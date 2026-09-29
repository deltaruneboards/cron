export default {
	async scheduled(event, env, ctx): Promise<void> {
		const response = await fetch('https://deltaruneboards.net/cron.php', {
			headers: {
				'X-CF-Worker': env.CRON_KEY,
			}
		});
		if (!response.ok) {
			const text = await response.text();
			console.error({
				message: 'cron.php responded with error',
				status: response.status,
				headers: response.headers,
				text,
			});
		}
		const json: any = await response.json();
		console.info({
			message: 'successful cron invocation',
			...json,
		});
	},
} satisfies ExportedHandler<Env>;
