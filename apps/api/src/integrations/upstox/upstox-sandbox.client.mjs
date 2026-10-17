
import UpstoxClient from 'upstox-js-sdk';
import {
    getUpstoxSandboxConfig,
    assertSandboxOnly,
} from '../../config/upstox.config.mjs';

export function createUpstoxSandboxClient() {
    const config = getUpstoxSandboxConfig();

    // Always construct the SDK explicitly in Sandbox mode.
    const client = new UpstoxClient.ApiClient(true);

    // Fail closed if the SDK configuration is unexpected.
    assertSandboxOnly(client);

    client.authentications.OAUTH2.accessToken = config.accessToken;

    return client;
}
