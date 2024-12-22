const { Schema, model } = require("mongoose");

const UserSchema = new Schema({
  userId: String,
  displayName: String,
  email: String,
  photoURL: String,
  isAnonymous: Boolean,
  providerId: String
});

const Document = new Schema({
  _id: String,
  data: Object,
  owner: UserSchema,
  lastEditedBy: {
    userId: String,
    displayName: String,
    timestamp: Date,
    email: String
  }
});

module.exports = model("Document", Document);