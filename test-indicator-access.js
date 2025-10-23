const axios = require("axios");

const BASE_URL = "http://localhost:3000";

// Test data
const testData = {
  // Create NODAL_OFFICER with limited indicator access
  createNodalOfficer: {
    email: "nodal.officer@test.com",
    password: "password123",
    firstName: "Nodal",
    lastName: "Officer",
    role: "NODAL_OFFICER",
    stateUt: "DL",
    indicatorCodes: ["1.1", "1.2", "2.1"], // Only these indicators
  },

  // Create submission with authorized indicators
  createSubmissionAuthorized: {
    submissionId: "TEST-001",
    formData: {
      1.1: { capitalAllocation: 1000000, gsdpForFY: 20000000 },
      1.2: { actualCapex: 800000, stateCapexUtilisation: 1000000 },
      2.1: { files: [{ name: "infra-act.pdf", url: "test-url" }] },
      generalInfo: { stateName: "Delhi", year: 2024 },
    },
    status: "DRAFT",
  },

  // Create submission with unauthorized indicators
  createSubmissionUnauthorized: {
    submissionId: "TEST-002",
    formData: {
      1.1: { capitalAllocation: 1000000, gsdpForFY: 20000000 },
      1.3: { creditRatedULBs: [{ name: "Test ULB" }] }, // Unauthorized indicator
      2.1: { files: [{ name: "infra-act.pdf", url: "test-url" }] },
      generalInfo: { stateName: "Delhi", year: 2024 },
    },
    status: "DRAFT",
  },
};

async function testIndicatorAccess() {
  console.log("🧪 Testing Indicator Access Control System\n");

  try {
    // Step 1: Create NODAL_OFFICER with limited indicator access
    console.log("1️⃣ Creating NODAL_OFFICER with limited indicator access...");
    const createUserResponse = await axios.post(
      `${BASE_URL}/auth/register`,
      testData.createNodalOfficer
    );
    console.log("✅ User created successfully");
    console.log("   User ID:", createUserResponse.data.user.id);
    console.log(
      "   Assigned Indicators:",
      testData.createNodalOfficer.indicatorCodes
    );

    const accessToken = createUserResponse.data.accessToken;
    const headers = { Authorization: `Bearer ${accessToken}` };

    // Step 2: Test authorized submission creation
    console.log(
      "\n2️⃣ Testing submission creation with AUTHORIZED indicators..."
    );
    try {
      const authorizedSubmission = await axios.post(
        `${BASE_URL}/submission`,
        testData.createSubmissionAuthorized,
        { headers }
      );
      console.log("✅ Authorized submission created successfully");
      console.log("   Submission ID:", authorizedSubmission.data.data.id);
    } catch (error) {
      console.log(
        "❌ Authorized submission failed:",
        error.response?.data?.message || error.message
      );
    }

    // Step 3: Test unauthorized submission creation
    console.log(
      "\n3️⃣ Testing submission creation with UNAUTHORIZED indicators..."
    );
    try {
      const unauthorizedSubmission = await axios.post(
        `${BASE_URL}/submission`,
        testData.createSubmissionUnauthorized,
        { headers }
      );
      console.log(
        "❌ Unauthorized submission should have failed but succeeded"
      );
    } catch (error) {
      console.log("✅ Unauthorized submission correctly blocked");
      console.log("   Error:", error.response?.data?.message || error.message);
    }

    // Step 4: Test data filtering on GET submission
    console.log("\n4️⃣ Testing data filtering on GET submission...");
    try {
      // First create a submission with all indicators
      const fullSubmissionData = {
        submissionId: "TEST-003",
        formData: {
          1.1: { capitalAllocation: 1000000, gsdpForFY: 20000000 },
          1.2: { actualCapex: 800000, stateCapexUtilisation: 1000000 },
          1.3: { creditRatedULBs: [{ name: "Test ULB" }] }, // Not assigned to user
          2.1: { files: [{ name: "infra-act.pdf", url: "test-url" }] },
          2.2: { files: [{ name: "specialized-entity.pdf", url: "test-url" }] }, // Not assigned to user
          generalInfo: { stateName: "Delhi", year: 2024 },
        },
        status: "DRAFT",
      };

      const fullSubmission = await axios.post(
        `${BASE_URL}/submission`,
        fullSubmissionData,
        { headers }
      );
      console.log("✅ Full submission created (with all indicators)");

      // Now get the submission and check if data is filtered
      const getSubmission = await axios.get(
        `${BASE_URL}/submission/${fullSubmission.data.data.id}`,
        { headers }
      );

      const formDataKeys = Object.keys(getSubmission.data.formData);
      console.log("   Form data keys in response:", formDataKeys);

      const hasUnauthorizedData = formDataKeys.some(
        (key) => ["1.3", "2.2"].includes(key) && key.match(/^\d+\.\d+$/)
      );

      if (hasUnauthorizedData) {
        console.log(
          "❌ Data filtering failed - unauthorized indicators visible"
        );
      } else {
        console.log(
          "✅ Data filtering working - only authorized indicators visible"
        );
      }
    } catch (error) {
      console.log(
        "❌ Data filtering test failed:",
        error.response?.data?.message || error.message
      );
    }

    console.log("\n🎉 Indicator Access Control Test Completed!");
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response?.data?.message || error.message
    );
  }
}

// Run the test
testIndicatorAccess();
