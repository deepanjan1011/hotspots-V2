
// Access Google Earth Engine Code Editor: https://code.earthengine.google.com/

// 1. Define Geometry: Delhi (NCT)
var delhi = ee.FeatureCollection("FAO/GAUL/2015/level2")
    .filter(ee.Filter.eq('ADM2_NAME', 'Delhi'));

Map.centerObject(delhi, 10);
Map.addLayer(delhi, { color: 'grey' }, 'Delhi Boundary');

// 2. Data Source: Landsat 8 (Summer 2024)
var collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
    .filterBounds(delhi)
    .filterDate('2024-04-01', '2024-06-30')
    .filter(ee.Filter.lt('CLOUD_COVER', 10));

// Process Images
var processImage = function (image) {
    var lst = image.select('ST_B10').multiply(0.00341802).add(149.0).subtract(273.15).rename('LST');
    var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
    return image.addBands(lst).addBands(ndvi).clip(delhi);
};

var processed = collection.map(processImage).median();

// Visualization Parameters
var lstVis = { min: 25, max: 50, palette: ['blue', 'limegreen', 'yellow', 'orange', 'red'] };
var ndviVis = { min: 0, max: 0.6, palette: ['white', 'green'] };

Map.addLayer(processed.select('LST'), lstVis, 'LST Heatmap');
Map.addLayer(processed.select('NDVI'), ndviVis, 'NDVI Vegetation');

// 3. Export Instructions - STATIC HIGH RES
// We will animate these in the frontend for 60fps smoothness

var exportParamsLST = {
    min: 25,
    max: 50,
    palette: ['blue', 'limegreen', 'yellow', 'orange', 'red'],
    dimensions: 1000, // Higher resolution
    region: delhi.geometry(),
    format: 'png'
};

var exportParamsNDVI = {
    min: 0,
    max: 0.6,
    palette: ['white', 'green'],
    dimensions: 1000, // Higher resolution
    region: delhi.geometry(),
    format: 'png'
};

print('LST Static Image URL:', processed.select('LST').getThumbURL(exportParamsLST));
print('NDVI Static Image URL:', processed.select('NDVI').getThumbURL(exportParamsNDVI));
