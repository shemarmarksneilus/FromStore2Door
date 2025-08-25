import Joi from 'joi';

export const createAccountSchema = Joi.object({
  email: Joi.string().email().required(),
  fullName: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('customer', 'driver', 'staff', 'admin').default('customer')
});

export const updateAccountSchema = Joi.object({
  fullName: Joi.string().min(2).max(100),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  timezone: Joi.string()
});

