import { createProposalProxy } from './proposal-proxy.mjs';

export default {
    '^/api(?:/|$)': createProposalProxy(process.env.ALPHAFORGE_LOCAL_API_TOKEN),
};
