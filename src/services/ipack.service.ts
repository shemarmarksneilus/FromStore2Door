import axios, { AxiosInstance } from 'axios';
import {pool} from '../config/database';

interface iPackConfig {
    apiUrl: string;
    apiKey: string;
    clientId: string;
    environment: 'production' | 'staging' | 'sandbox';
}

interface iPackOrder {
    id: string;
    orderNumber: string;
    customerId: string;
    customerEmail: string;
    customerName: string;
    status: string;
    items: iPackOrderItem[];
    shippingAddress: any;
    trackingNumber?: string;
    weight?: number;
    dimensions?: {
        length: number;
        width: number;
        height: number;
    };
    declaredValue?: number;
    createdAt: string;
    updatedAt: string;
}

interface iPackOrderItem {
    sku: string;
    description: string;
    quantity: number;
    unitprice: number;
    totalprice: number;
    weight?: number;
    hsCode?: string;
    currency?: string;
}

interface iPackInventory {
    sku: string;
    description: string;
    quantityAvailable: number;
    quantityReserved: number;
    location: string;
    lastUpdated: string;
}

interface iPackShipment {
    id: string;
    trackingNumber: string;
    status: string;
    origin: any;
    destination: any;
    estimatedDelivery?: string;
    actualDelivery?: string;
    events: iPackTrackingEvent[];
}

interface iPackTrackingEvent {
    timestamp: string;
    location: string;
    status: string;
    description: string;
}

export class iPackIntegrationService {
    private client: AxiosInstance;
    private config: iPackConfig;
    private lastTimestamp : Date | null = null;
    

    constructor(){
        this.config = {
            apiUrl: process.env.IPACK_API_URL || 'https://api.ipack.com',
            apiKey: process.env.IPACK_API_KEY || '',
            clientId: process.env.IPACK_CLIENT_ID || '',
            environment: (process.env.IPACK_ENVIRONMENT as 'production' | 'staging' | 'sandbox') || 'sandbox'
        };
    

    this.client = axios.create({
        baseURL: this.config.apiUrl,
        headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'Client-Id': this.config.clientId
        },
        timeout: 30000
    });


    this.client.interceptors.response.use(
        (response) => response,
        (error) => {
            console.error('iPack API Error:', {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url,
            });
            throw error;
            }
        );
    }
}


