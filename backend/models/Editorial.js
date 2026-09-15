'use strict';

const mongoose = require('mongoose');

const editorialSchema = new mongoose.Schema({
  contestId:          { type: Number, required: true, unique: true },
  blogEntryId:        { type: Number, default: null },
  editorialUrl:       { type: String, default: null },
  title:              { type: String, default: null },
  availableAt:        { type: Date,   default: null },
  editorialAvailable: { type: Boolean, default: false },
  fetchStatus: {
    type: String,
    enum: ['NOT_ATTEMPTED', 'FOUND', 'NOT_FOUND', 'SEARCH_FAILED'],
    default: 'NOT_ATTEMPTED'
  },
  fetchedAt: { type: Date,   default: null },
  notes:     { type: String, default: null }
}, { timestamps: false });

module.exports = mongoose.model('Editorial', editorialSchema);
