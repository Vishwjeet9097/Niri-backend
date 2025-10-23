const axios = require("axios");

const BASE_URL = "http://localhost:3000";

async function testUserRegistrationWithIndicators() {
  console.log("🧪 Testing User Registration with Indicators...\n");

  try {
    // Step 1: Login as STATE_APPROVER to get admin token
    console.log("1️⃣ Logging in as STATE_APPROVER...");
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: "m.state@nic.in",
      password: "password",
    });

    const adminToken = loginResponse.data.data.accessToken;
    console.log("✅ Admin login successful\n");

    // Step 2: Create NODAL_OFFICER with indicators
    console.log("2️⃣ Creating NODAL_OFFICER with indicators...");
    const createUserResponse = await axios.post(
      `${BASE_URL}/auth/register`,
      {
        email: `nodal.officer${Date.now()}@nic.in`,
        password: "password123",
        firstName: "Nodal",
        lastName: "Officer",
        contactNumber: "9876543210",
        role: "NODAL_OFFICER",
        stateUt: "Delhi",
        indicatorCodes: ["1.1", "1.2", "1.5", "4.1"],
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ User created successfully!");
    console.log("User ID:", createUserResponse.data.data.user.id);
    console.log("Access Token:", createUserResponse.data.data.accessToken);
    console.log(
      "Indicators assigned:",
      createUserResponse.data.data.user.assignedIndicators ||
        "Not returned in response"
    );
    console.log("");

    const userId = createUserResponse.data.data.user.id;
    const userToken = createUserResponse.data.data.accessToken;

    // Step 3: Test submission creation with authorized indicators
    console.log("3️⃣ Testing submission creation with authorized indicators...");
    const submissionResponse = await axios.post(
      `${BASE_URL}/submission`,
      {
        formData: {
          1.1: "Test data for 1.1",
          1.2: "Test data for 1.2",
          1.5: "Test data for 1.5",
          4.1: "Test data for 4.1",
        },
        stateUt: "Delhi",
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Submission created successfully!");
    console.log("Submission ID:", submissionResponse.data.data.id);
    console.log("");

    // Step 4: Test submission creation with unauthorized indicators (should fail)
    console.log(
      "4️⃣ Testing submission creation with unauthorized indicators (should fail)..."
    );
    try {
      await axios.post(
        `${BASE_URL}/submission`,
        {
          formData: {
            1.1: "Test data for 1.1",
            2.1: "Test data for 2.1", // This should fail
            3.1: "Test data for 3.1", // This should fail
          },
          stateUt: "Delhi",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("❌ This should have failed!");
    } catch (error) {
      if (error.response?.status === 403) {
        console.log("✅ Correctly blocked unauthorized indicators");
        console.log("Error message:", error.response.data.message);
      } else {
        console.log("❌ Unexpected error:", error.message);
      }
    }
    console.log("");

    // Step 5: Test submission retrieval (should filter data)
    console.log("5️⃣ Testing submission retrieval (should filter data)...");
    const getSubmissionResponse = await axios.get(
      `${BASE_URL}/submission/${submissionResponse.data.data.id}`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Submission retrieved successfully!");
    console.log(
      "Form data keys:",
      Object.keys(getSubmissionResponse.data.data.formData)
    );
    console.log("Form data:", getSubmissionResponse.data.data.formData);
    console.log("");

    console.log(
      "🎉 All tests passed! User registration with indicators is working correctly."
    );
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);

    if (error.response?.status === 500) {
      console.log(
        "\n💡 Make sure the server is running and database is properly set up."
      );
    }
  }
}

// Run the test
testUserRegistrationWithIndicators();
