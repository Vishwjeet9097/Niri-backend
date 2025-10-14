# NIRI Form Validation & Calculation Guide

## Overview

यह guide NIRI form में automatic calculation fields के लिए है। कुछ fields automatically calculate होते हैं और user input के लिए disabled होते हैं।

## Auto-Calculated Fields

### 1. % Allocation to GSDP (1.1)

**Formula:** `(Capital Allocation for FY / GSDP for FY) * 100`

**Dependencies:**

- `capitalAllocationForFY` (Capital Allocation for FY in INR)
- `gsdpForFY` (GSDP for FY in INR)

**Example:**

```
Capital Allocation for FY: ₹1,50,000 crores
GSDP for FY: ₹25,00,000 crores
% Allocation to GSDP: (1,50,000 / 25,00,000) * 100 = 6.0%
```

**Frontend Implementation:**

```javascript
// When either field changes, calculate the percentage
function calculateAllocationToGSDP(capitalAllocation, gsdp) {
  if (!capitalAllocation || !gsdp || gsdp === 0) return 0;
  return Math.round((capitalAllocation / gsdp) * 100 * 100) / 100;
}

// Update the disabled field
document.getElementById("allocationToGSDP").value =
  calculateAllocationToGSDP(
    parseFloat(document.getElementById("capitalAllocationForFY").value),
    parseFloat(document.getElementById("gsdpForFY").value)
  ) + "%";
```

### 2. % Capex Utilization (1.2)

**Formula:** `(Actual Capex / State Capex Utilisation) * 100`

**Dependencies:**

- `actualCapex` (Actual Capex in INR)
- `stateCapexUtilisation` (State Capex Utilisation in INR)

**Example:**

```
Actual Capex: ₹1,20,000 crores
State Capex Utilisation: ₹1,50,000 crores
% Capex Utilization: (1,20,000 / 1,50,000) * 100 = 80.0%
```

### 3. % of Credit Rated ULBs (1.3)

**Formula:** `(Credit Rated ULBs / Total ULBs) * 100`

**Dependencies:**

- `creditRatedULBs` (Number of Credit Rated ULBs)
- `totalULBs` (Total Number of ULBs)

### 4. % of ULBs Issuing Bonds (1.4)

**Formula:** `(ULBs Approved by MoSPI / Total ULBs Entered) * 100`

**Dependencies:**

- `ulbsApprovedByMoSPI` (Number of ULBs approved by MoSPI)
- `totalULBsEntered` (Total Number of ULBs entered)

## API Endpoints

### 1. Calculate % Allocation to GSDP

```http
POST /validation/calculate-allocation-to-gsdp
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "capitalAllocation": 150000,
  "gsdp": 2500000
}
```

**Response:**

```json
{
  "status": true,
  "data": {
    "capitalAllocation": 150000,
    "gsdp": 2500000,
    "allocationToGSDP": 6.0,
    "formatted": {
      "capitalAllocation": "1,50,000",
      "gsdp": "25,00,000",
      "allocationToGSDP": "6.0%"
    }
  },
  "message": "Allocation to GSDP calculated successfully",
  "timestamp": "2025-10-14T07:45:00.000Z"
}
```

### 2. Calculate % Capex Utilization

```http
POST /validation/calculate-capex-utilization
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "actualCapex": 120000,
  "stateCapexUtilisation": 150000
}
```

### 3. Calculate % of Credit Rated ULBs

```http
POST /validation/calculate-credit-rated-ulbs
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "creditRatedULBs": 25,
  "totalULBs": 100
}
```

### 4. Calculate % of ULBs Issuing Bonds

```http
POST /validation/calculate-ulbs-issuing-bonds
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "ulbsApprovedByMoSPI": 15,
  "totalULBsEntered": 100
}
```

### 5. Calculate All Fields

```http
POST /validation/calculate-all
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "capitalAllocationForFY": 150000,
  "gsdpForFY": 2500000,
  "actualCapex": 120000,
  "stateCapexUtilisation": 150000,
  "creditRatedULBs": 25,
  "totalULBs": 100,
  "ulbsApprovedByMoSPI": 15,
  "totalULBsEntered": 100
}
```

### 6. Get Validation Rules

```http
GET /validation/rules
Authorization: Bearer YOUR_TOKEN
```

## Frontend Implementation Guide

### HTML Structure

```html
<!-- Input fields -->
<div class="form-group">
  <label for="capitalAllocationForFY">Capital Allocation for FY (INR)*</label>
  <input
    type="number"
    id="capitalAllocationForFY"
    onchange="calculateAllocationToGSDP()"
  />
</div>

<div class="form-group">
  <label for="gsdpForFY">GSDP for FY (INR)*</label>
  <input type="number" id="gsdpForFY" onchange="calculateAllocationToGSDP()" />
</div>

<!-- Calculated field (disabled) -->
<div class="form-group">
  <label for="allocationToGSDP">% Allocation to GSDP*</label>
  <input type="text" id="allocationToGSDP" disabled readonly />
</div>
```

### JavaScript Implementation

```javascript
// Calculate % Allocation to GSDP
function calculateAllocationToGSDP() {
  const capitalAllocation =
    parseFloat(document.getElementById("capitalAllocationForFY").value) || 0;
  const gsdp = parseFloat(document.getElementById("gsdpForFY").value) || 0;

  if (gsdp === 0) {
    document.getElementById("allocationToGSDP").value = "0%";
    return;
  }

  const percentage = Math.round((capitalAllocation / gsdp) * 100 * 100) / 100;
  document.getElementById("allocationToGSDP").value = percentage + "%";
}

// Calculate % Capex Utilization
function calculateCapexUtilization() {
  const actualCapex =
    parseFloat(document.getElementById("actualCapex").value) || 0;
  const stateCapexUtilisation =
    parseFloat(document.getElementById("stateCapexUtilisation").value) || 0;

  if (stateCapexUtilisation === 0) {
    document.getElementById("capexUtilization").value = "0%";
    return;
  }

  const percentage =
    Math.round((actualCapex / stateCapexUtilisation) * 100 * 100) / 100;
  document.getElementById("capexUtilization").value = percentage + "%";
}

// Real-time calculation on input change
document.addEventListener("DOMContentLoaded", function () {
  // Add event listeners to all input fields
  const inputFields = [
    "capitalAllocationForFY",
    "gsdpForFY",
    "actualCapex",
    "stateCapexUtilisation",
    "creditRatedULBs",
    "totalULBs",
    "ulbsApprovedByMoSPI",
    "totalULBsEntered",
  ];

  inputFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener("input", function () {
        // Trigger appropriate calculation based on field
        if (fieldId === "capitalAllocationForFY" || fieldId === "gsdpForFY") {
          calculateAllocationToGSDP();
        } else if (
          fieldId === "actualCapex" ||
          fieldId === "stateCapexUtilisation"
        ) {
          calculateCapexUtilization();
        }
        // Add more calculations as needed
      });
    }
  });
});
```

### React Implementation

```jsx
import React, { useState, useEffect } from "react";

const FormField = ({
  label,
  value,
  onChange,
  disabled = false,
  calculated = false,
}) => {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        type="number"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={calculated ? "calculated-field" : ""}
      />
    </div>
  );
};

const NIRIForm = () => {
  const [formData, setFormData] = useState({
    capitalAllocationForFY: "",
    gsdpForFY: "",
    allocationToGSDP: "0%",
    actualCapex: "",
    stateCapexUtilisation: "",
    capexUtilization: "0%",
  });

  const calculateAllocationToGSDP = () => {
    const capitalAllocation = parseFloat(formData.capitalAllocationForFY) || 0;
    const gsdp = parseFloat(formData.gsdpForFY) || 0;

    if (gsdp === 0) {
      setFormData((prev) => ({ ...prev, allocationToGSDP: "0%" }));
      return;
    }

    const percentage = Math.round((capitalAllocation / gsdp) * 100 * 100) / 100;
    setFormData((prev) => ({ ...prev, allocationToGSDP: percentage + "%" }));
  };

  const calculateCapexUtilization = () => {
    const actualCapex = parseFloat(formData.actualCapex) || 0;
    const stateCapexUtilisation =
      parseFloat(formData.stateCapexUtilisation) || 0;

    if (stateCapexUtilisation === 0) {
      setFormData((prev) => ({ ...prev, capexUtilization: "0%" }));
      return;
    }

    const percentage =
      Math.round((actualCapex / stateCapexUtilisation) * 100 * 100) / 100;
    setFormData((prev) => ({ ...prev, capexUtilization: percentage + "%" }));
  };

  useEffect(() => {
    calculateAllocationToGSDP();
  }, [formData.capitalAllocationForFY, formData.gsdpForFY]);

  useEffect(() => {
    calculateCapexUtilization();
  }, [formData.actualCapex, formData.stateCapexUtilisation]);

  return (
    <form>
      <FormField
        label="Capital Allocation for FY (INR)*"
        value={formData.capitalAllocationForFY}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            capitalAllocationForFY: e.target.value,
          }))
        }
      />

      <FormField
        label="GSDP for FY (INR)*"
        value={formData.gsdpForFY}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, gsdpForFY: e.target.value }))
        }
      />

      <FormField
        label="% Allocation to GSDP*"
        value={formData.allocationToGSDP}
        disabled={true}
        calculated={true}
      />

      <FormField
        label="Actual Capex (INR)*"
        value={formData.actualCapex}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, actualCapex: e.target.value }))
        }
      />

      <FormField
        label="State Capex Utilisation (INR)*"
        value={formData.stateCapexUtilisation}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            stateCapexUtilisation: e.target.value,
          }))
        }
      />

      <FormField
        label="% Capex Utilization*"
        value={formData.capexUtilization}
        disabled={true}
        calculated={true}
      />
    </form>
  );
};

export default NIRIForm;
```

## CSS Styling for Calculated Fields

```css
.calculated-field {
  background-color: #f5f5f5;
  color: #666;
  cursor: not-allowed;
  border: 1px solid #ddd;
}

.calculated-field:focus {
  outline: none;
  box-shadow: none;
}

.form-group label {
  font-weight: bold;
  margin-bottom: 5px;
  display: block;
}

.form-group input[disabled] {
  opacity: 0.7;
}
```

## Validation Rules

1. **Required Fields:** सभी input fields required हैं
2. **Numeric Values:** सभी values numeric होनी चाहिए
3. **Positive Numbers:** Negative values allow नहीं हैं
4. **Division by Zero:** Zero values के लिए 0% return करना चाहिए
5. **Decimal Places:** Results को 2 decimal places तक round करना चाहिए

## Error Handling

```javascript
function safeCalculate(numerator, denominator) {
  try {
    if (!numerator || !denominator || denominator === 0) {
      return 0;
    }

    const result = (numerator / denominator) * 100;
    return Math.round(result * 100) / 100;
  } catch (error) {
    console.error("Calculation error:", error);
    return 0;
  }
}
```

## Testing

### Unit Tests

```javascript
describe("Allocation to GSDP Calculation", () => {
  test("should calculate correct percentage", () => {
    expect(calculateAllocationToGSDP(150000, 2500000)).toBe(6.0);
    expect(calculateAllocationToGSDP(0, 1000)).toBe(0);
    expect(calculateAllocationToGSDP(1000, 0)).toBe(0);
  });
});
```

### Integration Tests

```javascript
describe("Validation API", () => {
  test("should calculate allocation to GSDP", async () => {
    const response = await request(app)
      .post("/validation/calculate-allocation-to-gsdp")
      .send({ capitalAllocation: 150000, gsdp: 2500000 })
      .expect(200);

    expect(response.body.data.allocationToGSDP).toBe(6.0);
  });
});
```

## Summary

यह implementation ensure करता है कि:

1. **% Allocation to GSDP** automatically calculate होता है जब Capital Allocation और GSDP values change होती हैं
2. **Field disabled होता है** user input के लिए
3. **Real-time calculation** होती है जैसे ही dependent fields change होती हैं
4. **Proper error handling** है zero values और invalid inputs के लिए
5. **Consistent formatting** है सभी calculated values के लिए

Frontend developers को बस इन calculation functions को integrate करना है अपने forms में।
