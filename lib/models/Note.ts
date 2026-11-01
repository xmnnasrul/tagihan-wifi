import { Schema, model, Document, models, Model, Types } from 'mongoose';

export interface INote extends Document {
  ownerId: Types.ObjectId;
  text: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NoteSchema.index({ ownerId: 1, createdAt: -1 });

const Note: Model<INote> = models.Note || model<INote>('Note', NoteSchema);

export default Note;