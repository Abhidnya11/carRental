const mongoose = require('mongoose')

const pointSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Point'],
        required: true
    },
    coordinates: {
        type: [Number],
        required: true
    }
});

const emergencySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    location: {
        type: pointSchema,
        required: true
    },
    icon: {
        type: String,
        required: true
    }
})

module.exports = mongoose.model('emergency', emergencySchema)