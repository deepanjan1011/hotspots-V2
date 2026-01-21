# Project Overview

- It addresses the critical issue of urban heat vulnerability by leveraging machine learning and satellite data to identify areas that are most susceptible to extreme heat.
- It provides actionable insights for sustainable urban planning.
- By combining LST(Land Surface Temperature), NDVI(Normalised Difference Vegetation Index) and building density data, it creates comprehensive heat vulnerability maps that guide strategic tree planting and urban development decisions in Delhi.
- We use Random Forest Model to process the three key environmental factors: LST, NDVI and building footprint density.
- Google Earth Engine provides the satellite data infrastructure, while Gemini 2.5 flash fine tunes our model weights for optimal accuracy.
- The model uses carefully tuned weight(60% temperature, 20% vegetation, 20% buildings) to generate heat vulnerability scores.
- We then rasterize both building and tress density into uniform 100m grid cells across Delhi, creating a comprehensive feature matrix that captures the complex spatial relationships affecting urban heat.
- Through feature extraction and advanced ML techniques, our system identifies patterns that human planners might miss, providing unprecedented accuracy in predicting heat vulnerability across diverse urban environments.
- We overlay population density data to identify high-density residential zones that overlap with extreme heat islands.
- It integrates real-time and downloaded Air Quality Index (AQI) data to visualize the compounding effects of poor air quality and heat.
- We calculate a unified Health Risk Composite Score by combining Heat Vulnerability, Air Quality Stress and Population Exposure.
- We use a RAG-powered AI Urban Planning Assistant to provide context-aware analysis and actionable recommendations for specific coordinates.


summary:
so basically this project is a visulation and as well as planning tool i can say in short, it helps in visualising the suspectable areas on the map that will have a high heat vulnerability, and it helps in telling us which area needs trees and which dont inorder to cool down the temperature, and its mostly used by urban planning, public health officials and Residents. 

Q: can u tell me how it will help urban planning, public health officials and Residents?
- Urban Planners: Strategic Mapping: Knows exactly where to plant trees or use "cool-roof" materials to lower local temperatures.
- Public Health Officials: Risk Management: Identifies high-risk zones to deploy ambulances or cooling centers during heatwaves.
- Residents: Personal Safety: Provides hyper-local data to help people prepare for heat and advocate for greener neighborhoods.

Q: Why use 100m grid cells?
- A 100m grid is about the size of a standard football field or a single city block. Because the grid cells are so small, the tool can tell the difference between a park and a concrete shopping center right next to each other, which larger satellite views would just blur together.

Q: How Gemini helps in this project?
- 1. Smarter Math (Dynamic Weighting)
Instead of using the same 60/20/20 formula for the whole city, Gemini adjusts the weights based on the neighborhood. It "knows" that in crowded areas like Old Delhi, building density matters more than in open, suburban areas.

2. Human-Like Reasoning
Gemini doesn't just see numbers; it understands the layout. It can figure out how a tiny park affects the temperature of the specific buildings right next to it, providing a more accurate "real-feel" prediction.

3. Turning Data into Advice (RAG)
It translates a boring score (like "8.2/10") into a clear plan.

The Score: 8.2 (High Risk)

Gemini’s Advice: "This area is too crowded for a park. Use vertical gardens and white 'cool roofs' instead."

Q: including Population heatspots and AQI, and Health Risk, what is it trying to achieve more and what is the goal of the project and what problem does it solve???

By adding Population Hotspots and AQI (Air Quality Index), your project moves from being just a "weather map" to a "Life-Saving Tool." Here is what it achieves and the core problems it solves:

What is it trying to achieve more?
Beyond just finding heat, the project aims to identify "Double Vulnerability."

The Problem: Heat is dangerous, but heat plus poor air quality in a crowded area is a crisis. High heat often traps pollution near the ground, making it harder to breathe.

The Achievement: By creating a Health Risk Composite Score, the tool points out the "worst-of-the-worst" areas where people are most likely to get sick or hospitalized. It prioritizes human life over just temperature numbers.

The Goal of the Project
The ultimate goal is Heat Resilience for Delhi. It aims to transform Delhi from a city that reacts to heatwaves (sending ambulances after people get sick) to a city that prevents heat illness (planting trees and cooling buildings in the right spots years in advance).

What problem does it solve?
It solves the "Blind Spot" in urban planning.

Inefficiency: Currently, cities might plant trees where there is space, not necessarily where they are needed most. This tool ensures every tree planted has the maximum cooling impact.

Inequality: It reveals how "concrete jungles" often overlap with low-income, high-density housing. It helps solve the problem of environmental injustice by showing where residents lack "green cover."

Data Overload: Planners have too much raw data (satellite, census, weather). This project simplifies everything into one Actionable Map that anyone can understand.