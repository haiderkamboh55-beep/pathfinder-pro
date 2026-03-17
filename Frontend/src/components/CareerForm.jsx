import axios from 'axios';

const submitForm = async (formData) => {
  try {
    const response = await axios.post("http://localhost:8000/recommend", formData);
    setResults(response.data); // Update UI with job list
  } catch (error) {
    console.error("Submission failed", error);
  }
};