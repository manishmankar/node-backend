import mongoose from 'mongoose';

const productUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    role: {
      type: String,
      default: 'User',
      trim: true
    },
    department: {
      type: String,
      default: 'General',
      trim: true
    },
    product: {
      type: String,
      default: null,
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['Active', 'Inactive', 'Pending'],
        message: '{VALUE} is not a valid status'
      },
      default: 'Active'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes for high performance lookups
productUserSchema.index({ product: 1 });
productUserSchema.index({ role: 1 });
productUserSchema.index({ status: 1 });

export const ProductUser = mongoose.model('ProductUser', productUserSchema);
