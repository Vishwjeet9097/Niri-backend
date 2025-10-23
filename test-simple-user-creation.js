const axios = require("axios");

const BASE_URL = "http://localhost:3000";

async function testSimpleUserCreation() {
  console.log("🧪 Testing Simple User Creation...\n");

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
    console.log("");

    // Step 3: Check database
    console.log("3️⃣ Checking database...");
    const { exec } = require("child_process");

    exec(
      'PGPASSWORD=postgres123 psql -h localhost -U postgres -d niri_dev -c "SELECT uis.user_id, uis.indicator_id, i.code, i.indicator_name FROM user_indicator_scope uis LEFT JOIN indicators i ON uis.indicator_id = i.id ORDER BY uis.user_id, i.code;"',
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error: ${error}`);
          return;
        }
        console.log("Database query result:");
        console.log(stdout);
      }
    );
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Run the test
testSimpleUserCreation();
