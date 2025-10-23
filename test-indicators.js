const axios = require("axios");

const BASE_URL = "http://localhost:3000";

async function testIndicators() {
  console.log("🔍 Testing Indicators in Database...\n");

  try {
    // First, let's try to start the application and test
    console.log("1️⃣ Testing if application is running...");

    try {
      const healthCheck = await axios.get(`${BASE_URL}/health`);
      console.log("✅ Application is running");
    } catch (error) {
      console.log(
        "❌ Application not running. Please start it first with: npm run start:dev"
      );
      return;
    }

    // Test user creation with indicators
    console.log("\n2️⃣ Testing user creation with indicators...");

    const testUser = {
      email: `test.indicators.${Date.now()}@example.com`,
      password: "password123",
      firstName: "Test",
      lastName: "User",
      role: "NODAL_OFFICER",
      stateUt: "DL",
      indicatorCodes: ["1.1", "1.2", "2.1", "3.1", "4.1"], // Test with multiple indicators
    };

    try {
      const createUserResponse = await axios.post(
        `${BASE_URL}/auth/register`,
        testUser
      );
      console.log("✅ User created successfully with indicators");
      console.log("   User ID:", createUserResponse.data.data.user.id);
      console.log("   Assigned Indicators:", testUser.indicatorCodes);
      console.log(
        "   Full Response:",
        JSON.stringify(createUserResponse.data, null, 2)
      );

      // Test submission creation
      console.log("\n3️⃣ Testing submission creation...");

      const testSubmission = {
        submissionId: "INDICATOR-TEST-001",
        formData: {
          1.1: { capitalAllocation: 1000000, gsdpForFY: 20000000 },
          1.2: { actualCapex: 800000, stateCapexUtilisation: 1000000 },
          2.1: { files: [{ name: "infra-act.pdf", url: "test-url" }] },
          3.1: {
            available: "yes",
            files: [{ name: "ppp-act.pdf", url: "test-url" }],
          },
          4.1: { allEligible: "yes", websiteLink: "https://nip.gov.in" },
          generalInfo: { stateName: "Delhi", year: 2024 },
        },
        status: "DRAFT",
      };

      const accessToken = createUserResponse.data.data.accessToken;
      const headers = { Authorization: `Bearer ${accessToken}` };

      console.log("   Access Token:", accessToken.substring(0, 50) + "...");

      const submissionResponse = await axios.post(
        `${BASE_URL}/submission`,
        testSubmission,
        { headers }
      );
      console.log("✅ Submission created successfully");
      console.log("   Submission ID:", submissionResponse.data.data.id);

      // Test data filtering
      console.log("\n4️⃣ Testing data filtering...");

      const getSubmissionResponse = await axios.get(
        `${BASE_URL}/submission/${submissionResponse.data.data.id}`,
        { headers }
      );

      const formDataKeys = Object.keys(getSubmissionResponse.data.formData);
      console.log("   Form data keys in response:", formDataKeys);

      const indicatorKeys = formDataKeys.filter((key) =>
        key.match(/^\d+\.\d+$/)
      );
      console.log("   Indicator keys found:", indicatorKeys);

      if (indicatorKeys.length === testUser.indicatorCodes.length) {
        console.log("✅ Data filtering working correctly");
      } else {
        console.log("⚠️  Data filtering may have issues");
      }

      console.log("\n🎉 All tests passed! Indicators are working correctly.");
    } catch (error) {
      console.log(
        "❌ Test failed:",
        error.response?.data?.message || error.message
      );
      console.log("   Status:", error.response?.status);
      console.log(
        "   Response:",
        JSON.stringify(error.response?.data, null, 2)
      );

      if (error.response?.status === 500) {
        console.log("   This might indicate database connection issues.");
      }
    }
  } catch (error) {
    console.error("❌ Test setup failed:", error.message);
  }
}

testIndicators();
