import axios from 'axios';
import * as vscode from 'vscode';

interface SearchResult {
    url: string;
    title: string;
    snippet: string;
}

export class WebSearch {
    private apiKeys: { [key: string]: string } = {};
    private googleCustomSearchEngineId: string = '';

    constructor() {
        this.loadConfigurations();
    }

    private loadConfigurations() {
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode.webSearch');
        this.apiKeys = {
            google: config.get('googleApiKey') || '',
            brave: config.get('braveApiKey') || '',
        };
        this.googleCustomSearchEngineId = config.get('googleCustomSearchEngineId') || '';
    }

    async search(query: string, provider: string = 'duckduckgo'): Promise<SearchResult[]> {
        switch (provider.toLowerCase()) {
            case 'google':
                return this.googleSearch(query);
            case 'brave':
                return this.braveSearch(query);
            case 'duckduckgo':
                return this.duckDuckGoSearch(query);
            default:
                throw new Error(`Unsupported search provider: ${provider}`);
        }
    }

    private async googleSearch(query: string): Promise<SearchResult[]> {
        if (!this.apiKeys.google) {
            throw new Error('Google API key is not set');
        }
        if (!this.googleCustomSearchEngineId) {
            throw new Error('Google Custom Search Engine ID is not set');
        }

        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
                key: this.apiKeys.google,
                cx: this.googleCustomSearchEngineId,
                q: query,
                num: 5
            }
        });

        return response.data.items.map((item: any) => ({
            url: item.link,
            title: item.title,
            snippet: item.snippet
        }));
    }

    private async braveSearch(query: string): Promise<SearchResult[]> {
        if (!this.apiKeys.brave) {
            throw new Error('Brave API key is not set');
        }

        const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
            headers: {
                'X-Subscription-Token': this.apiKeys.brave
            },
            params: {
                q: query,
                count: 5
            }
        });

        return response.data.web.results.map((item: any) => ({
            url: item.url,
            title: item.title,
            snippet: item.description
        }));
    }

    private async duckDuckGoSearch(query: string): Promise<SearchResult[]> {
        const response = await axios.get('https://api.duckduckgo.com/', {
            params: {
                q: query,
                format: 'json',
                no_html: 1,
                no_redirect: 1
            }
        });

        return response.data.RelatedTopics.slice(0, 5).map((item: any) => ({
            url: item.FirstURL,
            title: item.Text.split(' - ')[0],
            snippet: item.Text.split(' - ')[1] || ''
        }));
    }
}