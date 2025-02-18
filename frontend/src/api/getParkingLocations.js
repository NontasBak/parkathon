import axios from "axios";

const TIMESTAMP = '2023-10-15T14:00:00';
const WEATHER = 'Sunny 23C';

export const getParkingLocations = async (lat, lon, rad) => {
    try {
        const response = await axios.get(
            `/mlm/predict?lat=${lat}&lon=${lon}&timestamp=${TIMESTAMP}&weather=${WEATHER}&radius=${rad}`
        );
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.error("Error getting parking locations:", error.response.data.error);
        throw error;
    }
};
