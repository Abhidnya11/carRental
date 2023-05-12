const mongoose = require('mongoose')
const express = require('express')
const app = express()

const neo4j = require('neo4j-driver')

const driver = neo4j.driver('neo4j://localhost:7687', neo4j.auth.basic('neo4j', 'Aasd@12345'));
const session = driver.session()

const emergency = require('./models/emergency')
const cab = require('./models/cab')
const firefighter = require('./models/firefighter')
let allCabs = []
let allfirefighters = []
let allEmergencies = []

mongoose.connect('mongodb://127.0.0.1:27017/carRental', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});



app.use(express.static("public"));

app.set('view engine', 'ejs')

app.post('/travel', async (req, res) => {
    //mapping all markers with their coordinates
    let map = new Map();
    //mapping cabs with their distance with emergency(final distance)
    let distanceMap = new Map();
    //mapping all stops to reach emergency
    let stopMap = new Map();

    //loop through all cabs and put in map
    for(let i = 0; i < allCabs.length; i++) {
        let point = allCabs[i].location.coordinates;
        map.set(allCabs[i].name, point);
    }
    
    //loop through all firefighters and put in map
    for(let i = 0; i < allfirefighters.length; i++) {
        let point = allfirefighters[i].location.coordinates;
        map.set(allfirefighters[i].name, point);
    }
    
    //loop through all emergencies and put in map
    for(let i = 0; i < allEmergencies.length; i++) {
        let point = allEmergencies[i].location.coordinates;
        map.set(allEmergencies[i].name, point);
    }

    for (let i = 0; i < allCabs.length; i++) {
        let transaction = await session.beginTransaction();
        let firefighterLast = "";
        let firefighterFirst = "";
        let totalDistance = 0;
        let stops = []
        //closest firefighter to car
        let carLon = allCabs[i].location.coordinates[0];
        let carLat = allCabs[i].location.coordinates[1];
    
        //add first location to stops
        stops.push(allCabs[i].location.coordinates);
        const query = `MATCH (getFirefighters:Firefighter)
        WITH COLLECT(getFirefighters.firefighter_id) AS firefighter_Ids
        MATCH (end:Firefighter)
        WHERE end.firefighter_id IN firefighter_Ids
        WITH end, point.distance(point({longitude: ${carLat}, latitude:${carLon}}),
        point({longitude: end.lon, latitude: end.lat}))/1000 AS dist
        RETURN end.firefighter_name as firefighter_name, dist as dist ORDER BY dist ASC LIMIT 1`;
        await transaction.run(query).then((result) => {
            result.records.forEach((record) => {
                
                totalDistance += record.get('dist');
                //closest firefighter from cab
                firefighterFirst = record.get('firefighter_name');
            });
        })
        
        stops.push(map.get(firefighterFirst))
        
        //closest next firefighter
        const query2 = `MATCH (getFirefighters:Firefighter)
        WITH COLLECT(getFirefighters.firefighter_id) AS firefighter_Ids
        MATCH (end:Firefighter)
        WHERE end.firefighter_id IN firefighter_Ids
        WITH end, point.distance(point({longitude: ${map.get(firefighterFirst)[1]}, latitude:${map.get(firefighterFirst)[0]}}),
        point({longitude: end.lon, latitude: end.lat}))/1000 AS dist
        RETURN end.firefighter_name as firefighter_name, dist as dist ORDER BY dist ASC LIMIT 2`;
        await transaction.run(query2).then((result) => {
            totalDistance += result.records[1].get('dist');
            //closest firefighter to first firefighter
            firefighterLast = result.records[1].get('firefighter_name');
        })
        stops.push(map.get(firefighterLast));
        
        //firefighter to emergency
        const emergencyCoord = map.get('Mannheim HBF');
        const query3 = `MATCH (getFirefighters:Firefighter)
        WITH COLLECT(getFirefighters.firefighter_id) AS firefighter_Ids
        MATCH (end:Firefighter)
        WHERE end.firefighter_id IN firefighter_Ids
        WITH end, point.distance(point({longitude: ${emergencyCoord[1]}, latitude:${emergencyCoord[0]}}),
        point({longitude: end.lon, latitude: end.lat}))/1000 AS dist
        RETURN end.firefighter_name as firefighter_name, dist as dist ORDER BY dist ASC LIMIT 1`;
        await transaction.run(query3).then((result) => {
            totalDistance += result.records[0].get('dist')
        })
        stops.push(emergencyCoord)

        await transaction.close()
        distanceMap.set(allCabs[i].name, totalDistance);
        stopMap.set(allCabs[i].name, stops);
    }

    let minDist = Number.MAX_SAFE_INTEGER;
    let finalCab = ""
    for (let [key, value] of distanceMap) {
        console.log(key + " = " + value);
        if(minDist > value) {
            minDist = value;
            finalCab = key;
        }
    }
    await session.close() 
    res.send(stopMap.get(finalCab));
})



app.get('/', async (req, res) => {
    //fetch firefighters from mongoDB
    const firefighters = await firefighter.find().exec();
    //fetch cabs from mongoDB
    const cabs = await cab.find().exec();
    //fetch emergencies from mongoDB
    const emergencies = await emergency.find().exec();
    allfirefighters.push(...firefighters)
    allCabs.push(...cabs)
    allEmergencies.push(...emergencies)
    const markers = [];
    markers.push(...firefighters);
    markers.push(...cabs);
    markers.push(...emergencies);
    
    res.render('index', { markers: markers })
})

app.listen(3000)