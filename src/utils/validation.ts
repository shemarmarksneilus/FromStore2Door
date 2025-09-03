import Joi from 'joi';

// Auth validation schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  fullName: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  role: Joi.string().valid('customer', 'driver', 'staff', 'admin').default('customer')
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

// Account validation schemas
export const createAccountSchema = Joi.object({
  email: Joi.string().email().required(),
  fullName: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  role: Joi.string().valid('customer', 'driver', 'staff', 'admin').default('customer')
});

export const updateAccountSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  role: Joi.string().valid('customer', 'driver', 'staff', 'admin').optional(),
  isActive: Joi.boolean().optional()
});



// Package validation schemas
export const createPackageSchema = Joi.object({
  trackingNo: Joi.string().required(),
  warehouseId: Joi.number().integer().positive().required(),
  customerId: Joi.string().uuid().optional(),
  weight: Joi.number().positive().optional(),
  dimensions: Joi.object({
    length: Joi.number().positive().required(),
    width: Joi.number().positive().required(),
    height: Joi.number().positive().required()
  }).optional(),
  declaredValue: Joi.number().positive().optional(),
  contents: Joi.string().max(500).optional()
});

export const updatePackageStatusSchema = Joi.object({
  status: Joi.string().valid(
    'pre_alert', 'received', 'in_warehouse', 'cleared', 
    'out_for_delivery', 'delivered', 'returned'
  ).required(),
  note: Joi.string().max(500).optional()
});


// Warehouse validation schemas
export const createWarehouseSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  type: Joi.string().valid('local', 'overseas').required(),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().optional(),
    country: Joi.string().required(),
    postalCode: Joi.string().optional()
  }).required(),
  timezone: Joi.string().pattern(/^[A-Za-z]+\/[A-Za-z_]+$/).required(),
  operatorId: Joi.number().integer().positive().optional()
});

// Manifest validation schemas
export const createManifestSchema = Joi.object({
  warehouseId: Joi.number().integer().positive().required(),
  externalRef: Joi.string().optional(),
  origin: Joi.object({
    city: Joi.string().required(),
    country: Joi.string().required(),
    airport: Joi.string().optional()
  }).required(),
  destination: Joi.object({
    city: Joi.string().required(),
    country: Joi.string().required(),
    airport: Joi.string().optional()
  }).required(),
  flightNo: Joi.string().optional(),
  eta: Joi.date().iso().optional()
});


export const addManifestItemSchema = Joi.object({
  trackingNo: Joi.string().required(),
  description: Joi.string().max(500).required(),
  pieces: Joi.number().integer().positive().required(),
  weight: Joi.number().positive().required(),
  value: Joi.number().positive().optional()
});

export const updateDeliveryStatusSchema = Joi.object({
  status: Joi.string().valid('scheduled', 'in_transit', 'delivered', 'failed', 'rescheduled').required(),
  note: Joi.string().max(500).optional(),
  imageUrl: Joi.string().uri().optional(),
  gps: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  }).optional()
});

// Query parameter validation schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

export const packageQuerySchema = paginationSchema.keys({
  warehouseId: Joi.number().integer().positive().optional(),
  customerId: Joi.string().uuid().optional(),
  status: Joi.string().valid(
    'pre_alert', 'received', 'in_warehouse', 'cleared', 
    'out_for_delivery', 'delivered', 'returned'
  ).optional(),
  trackingNo: Joi.string().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional()
});

export const manifestQuerySchema = paginationSchema.keys({
  warehouseId: Joi.number().integer().positive().optional(),
  status: Joi.string().valid('draft', 'in_transit', 'arrived', 'cleared', 'deconsolidated').optional(),
  flightNo: Joi.string().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional()
});

export const accountQuerySchema = paginationSchema.keys({
  role: Joi.string().valid('customer', 'driver', 'staff', 'admin').optional(),
  isActive: Joi.boolean().optional(),
  search: Joi.string().min(2).optional()
});

export const createCustomsDeclarationSchema = Joi.object({
  packageId: Joi.number().integer().positive().required(),
  declarationNo: Joi.string().optional(),
  items: Joi.array().items(
    Joi.object({
      hsCode: Joi.string().optional(),
      description: Joi.string().required(),
      qty: Joi.number().integer().positive().required(),
      valueUsd: Joi.number().positive().required(),
      dutyRate: Joi.number().min(0).max(100).optional()
    })
  ).min(1).required()
});

// Rate card validation schemas
export const createRateCardSchema = Joi.object({
  rateGroupId: Joi.number().integer().positive().required(),
  weightStart: Joi.number().min(0).required(),
  weightEnd: Joi.number().min(0).required(),
  zone: Joi.string().optional(),
  price: Joi.number().positive().required()
}).custom((value, helpers) => {
  if (value.weightEnd <= value.weightStart) {
    return helpers.error('Weight end must be greater than weight start');
  }
  return value;
});

// File upload validation schemas
export const fileUploadSchema = Joi.object({
  filename: Joi.string().required(),
  mimetype: Joi.string().valid(
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ).required(),
  size: Joi.number().max(10 * 1024 * 1024).required() // 10MB max
});

// API connection validation schemas
export const createApiConnectionSchema = Joi.object({
  warehouseId: Joi.number().integer().positive().required(),
  customerId: Joi.string().uuid().optional(),
  provider: Joi.string().valid(
    'extensiv', 'logiwa', 'camelot', 'softeon', 
    'magaya', 'generic_json', 'csv_ftp'
  ).required(),
  credentials: Joi.object().required(),
  partnershipType: Joi.string().valid('client_provided', 'pre_negotiated').required()
});

// Expense validation schemas
export const createExpenseSchema = Joi.object({
  category: Joi.string().valid('fuel', 'maintenance', 'salary', 'utilities', 'other').required(),
  amount: Joi.number().positive().required(),
  note: Joi.string().max(500).optional(),
  fileUrl: Joi.string().uri().optional()
});

// System config validation schemas
export const updateSystemConfigSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.object(),
    Joi.array()
  ).required()
});


// Validation middleware helper
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: error.details.map(d => d.message)
      });
    }
    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.params);
    if (error) {
      return res.status(400).json({
        error: 'Parameter validation failed',
        details: error.details.map(d => d.message)
      });
    }
    req.params = value;
    next();
  };
};

// Pre-alert validation schemas
export const createPreAlertSchema = Joi.object({
  trackingNo: Joi.string().required(),
  warehouseId: Joi.number().integer().positive().required(),
  customerId: Joi.string().uuid().optional(),
  carrier: Joi.string().max(100).optional(),
  expectedDate: Joi.date().iso().optional(),
  weight: Joi.number().positive().optional(),
  dimensions: Joi.object({
    length: Joi.number().positive().required(),
    width: Joi.number().positive().required(),
    height: Joi.number().positive().required()
  }).optional(),
  contents: Joi.string().max(500).optional()
});

export const updatePreAlertSchema = Joi.object({
  status: Joi.string().valid('pending', 'received', 'cancelled').required(),
  note: Joi.string().max(500).optional()
}); 

// Tally sheet validation schemas
export const createTallySheetSchema = Joi.object({
  warehouseId: Joi.number().integer().positive().required(),
  date: Joi.date().iso().required(),
  items: Joi.array().items(
    Joi.object({
      description: Joi.string().required(),
      quantity: Joi.number().integer().positive().required(),
      condition: Joi.string().valid('good', 'damaged', 'missing').required()
    })
  ).min(1).required(),
  notes: Joi.string().max(1000).optional()
});

export const updateTallySheetSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      description: Joi.string().required(),
      quantity: Joi.number().integer().positive().required(),
      condition: Joi.string().valid('good', 'damaged', 'missing').required()
    })
  ).min(1).optional(),
  notes: Joi.string().max(1000).optional()
});   

