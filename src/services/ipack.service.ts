

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


