# Parkathon

Parkathon is a web application designed to help users find parking spots efficiently. Using user feedback and machine learning, it provides probabilistic predictions for parking availability, making it the perfect parking companion.

## Known Issues

- **Browsers**

  - Some browsers like Chrome or Brave restrict geolocation because we have self-signed SSL certificate! (Alternatives like Microsoft Edge or Firefox work for geolocation).
  - Some browsers like Firefox do not support Voice Recognition (Alternatives are Chromium based browsers).
  
TL;DR We recommend testing the application on Microsoft Edge.

## Features

- **Real-time Availability**

Determines parking availability based on nearby users' parking or unparking activities.

- **Historical Data Analysis**

Fetches historical parking data from a database and uses a machine learning model to predict future parking availability.

- **User-friendly Interface**

An intuitive frontend to display parking predictions to users through a map.

- **Parking Status**

Users can mark spots as parked or evacuated based on their vehicle’s location.
Collected data is stored in a database and later used to train an AI model to predict future parking availability.
Parking outside designated OpenStreetMap-based locations is considered illegal and is not recorded.
Examples of illegal parking include spots near intersections, trash cans, or other restricted areas.

- **Search for Available Spots**

Users can search for empty parking spaces near a specified area using text or voice commands.
The AI model analyzes unoccupied spots to estimate the likelihood of them being truly available.

## Deploy

How to deploy with docker-compose

```
docker-compose build
docker-compose up
```

## Documentation

For more information about the application you can view the `docs/` directory.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
