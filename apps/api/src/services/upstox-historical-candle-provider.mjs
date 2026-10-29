export class UpstoxHistoricalCandleProvider {
    async getHistoricalCandles() {
        throw new Error(
            'Upstox historical candles are disabled because no Sandbox endpoint is verified.',
        );
    }
}
