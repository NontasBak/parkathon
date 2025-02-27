import axios from "axios";

// Send parking location to backend
export const occupyPark = async (userId, lat, lon) => {
    try {
        const response = await axios.post(
            `/api/park/occupy?user=${userId}&lat=${lat}&lon=${lon}`,
        );
        console.log("Response:", response.data);
        return response.data;
    } catch (error) {
        console.error(
            "Error sending parking location:",
            error.response.data.error,
        );
        throw error;
    }
};
