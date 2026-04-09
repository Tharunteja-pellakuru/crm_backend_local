const db = require("../config/db.js");
const ExcelJS = require("exceljs");

// Helper function to create Excel workbook with data
const createExcelWorkbook = async (data, headers, sheetName, title) => {
  const workbook = new ExcelJS.Workbook();

  // Add metadata
  workbook.creator = "Parivartan CRM";
  workbook.lastModifiedBy = "Parivartan CRM";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName);

  // Set column widths
  worksheet.columns = headers.map((header) => ({
    header: header,
    key: header,
    width: Math.max(header.length + 5, 15),
  }));

  // Add title row with styling
  const titleRow = worksheet.addRow([title]);
  titleRow.font = { size: 16, bold: true, color: { argb: "FF18254D" } };
  titleRow.height = 25;
  worksheet.mergeCells(`A1:${String.fromCharCode(65 + headers.length - 1)}1`);

  // Add empty row for spacing
  worksheet.addRow([]);

  // Add header row with styling
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF18254D" },
  };
  headerRow.height = 20;

  // Add data rows with alternating colors
  data.forEach((row, index) => {
    const dataRow = worksheet.addRow(
      headers.map((header) => row[header] || "-"),
    );
    dataRow.height = 18;

    // Alternate row colors
    if (index % 2 === 0) {
      dataRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    }

    // Style borders
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : "";
      maxLength = Math.max(maxLength, cellValue.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });

  return workbook;
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Helper function to format datetime
const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 1. ENQUIRIES EXPORT
const exportEnquiries = async (req, res) => {
  const query = `
    SELECT
      enquiry_id,
      uuid,
      full_name,
      email,
      phone_number,
      website_url,
      message,
      status,
      remarks,
      created_at,
      updated_at
    FROM crm_tbl_enquiries
    ORDER BY created_at DESC
  `;

  try {
    const [results] = await db.promise().query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "Empty records" });
    }

    // Transform data for Excel
    const transformedData = results.map((row, index) => ({
      "S.No": index + 1,
      "Enquiry ID": row.enquiry_id,
      Name: row.full_name || "-",
      Email: row.email || "-",
      Phone: row.phone_number || "-",
      Website: row.website_url || "-",
      Message: row.message || "-",
      Status: row.status || "New",
      Remarks: row.remarks || "-",
      "Created Date": formatDate(row.created_at),
    }));

    const headers = [
      "S.No",
      "Enquiry ID",
      "Name",
      "Email",
      "Phone",
      "Website",
      "Message",
      "Status",
      "Remarks",
      "Created Date",
    ];

    const workbook = await createExcelWorkbook(
      transformedData,
      headers,
      "Enquiries",
      "CRM Enquiries Export",
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=enquiries_export.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting enquiries:", err);
    return res.status(500).json({ message: "Error exporting enquiries" });
  }
};

// 2. LEADS EXPORT (WITH ENQUIRY LINK)
const exportLeads = async (req, res) => {
  const query = `
    SELECT
      l.lead_id,
      l.uuid,
      l.full_name,
      l.phone_number,
      l.email,
      l.lead_status,
      l.lead_category,
      l.website_url,
      l.message,
      e.enquiry_id,
      e.status AS enquiry_status,
      l.created_at,
      l.updated_at
    FROM crm_tbl_leads l
    LEFT JOIN crm_tbl_enquiries e
      ON l.enquiry_id = e.enquiry_id
    ORDER BY l.created_at DESC
  `;

  try {
    const [results] = await db.promise().query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "Empty records" });
    }

    // Transform data for Excel
    const transformedData = results.map((row, index) => ({
      "S.No": index + 1,
      "Lead ID": row.lead_id,
      Name: row.full_name || "-",
      Phone: row.phone_number || "-",
      Email: row.email || "-",
      "Lead Status": row.lead_status || "-",
      "Lead Source": row.enquiry_id ? "Enquiry" : "Manual",
      "Enquiry Status": row.enquiry_status || "-",
      Website: row.website_url || "-",
      Message: row.message || "-",
      "Created Date": formatDate(row.created_at),
    }));

    const headers = [
      "S.No",
      "Lead ID",
      "Name",
      "Phone",
      "Email",
      "Lead Status",
      "Lead Source",
      "Enquiry Status",
      "Website",
      "Message",
      "Created Date",
    ];

    const workbook = await createExcelWorkbook(
      transformedData,
      headers,
      "Leads",
      "CRM Leads Export",
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=leads_export.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting leads:", err);
    return res.status(500).json({ message: "Error exporting leads" });
  }
};

// 3. FOLLOW-UPS EXPORT
const exportFollowups = async (req, res) => {
  const query = `
    SELECT
      f.followup_id AS followup_id,
      f.uuid,
      f.followup_title,
      f.followup_description,
      f.followup_datetime,
      f.followup_mode,
      f.followup_status,
      f.followup_priority,
      l.full_name AS lead_name,
      l.phone_number AS lead_phone,
      p.project_name,
      f.created_at
    FROM crm_tbl_followups f
    LEFT JOIN crm_tbl_leads l
      ON f.lead_id = l.lead_id
    LEFT JOIN crm_tbl_projects p
      ON f.project_id = p.project_id
    ORDER BY f.followup_datetime DESC
  `;

  try {
    const [results] = await db.promise().query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "Empty records" });
    }

    // Transform data for Excel
    const transformedData = results.map((row, index) => ({
      "S.No": index + 1,
      "Follow-up ID": row.followup_id,
      Title: row.followup_title || "-",
      Description: row.followup_description || "-",
      "Date & Time": formatDateTime(row.followup_datetime),
      Mode: row.followup_mode || "-",
      Status: row.followup_status || "Pending",
      Priority: row.followup_priority || "Medium",
      "Lead Name": row.lead_name || "-",
      "Lead Phone": row.lead_phone || "-",
      "Project Name": row.project_name || "-",
      "Created Date": formatDate(row.created_at),
    }));

    const headers = [
      "S.No",
      "Follow-up ID",
      "Title",
      "Description",
      "Date & Time",
      "Mode",
      "Status",
      "Priority",
      "Lead Name",
      "Lead Phone",
      "Project Name",
      "Created Date",
    ];

    const workbook = await createExcelWorkbook(
      transformedData,
      headers,
      "Follow-ups",
      "CRM Follow-ups Export",
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=followups_export.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting followups:", err);
    return res.status(500).json({ message: "Error exporting followups" });
  }
};

// 4. CLIENTS EXPORT
const exportClients = async (req, res) => {
  const query = `
    SELECT
      c.client_id,
      c.uuid,
      c.organisation_name,
      c.client_name,
      c.client_country,
      c.client_state,
      c.client_currency,
      c.client_status,
      l.full_name AS lead_name,
      c.created_at
    FROM crm_tbl_clients c
    LEFT JOIN crm_tbl_leads l
      ON c.lead_id = l.lead_id
    ORDER BY c.created_at DESC
  `;

  try {
    const [results] = await db.promise().query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "Empty records" });
    }

    // Transform data for Excel
    const transformedData = results.map((row, index) => ({
      "S.No": index + 1,
      "Client ID": row.client_id,
      "Organization Name": row.organisation_name || "-",
      "Contact Person": row.client_name || "-",
      Country: row.client_country || "-",
      State: row.client_state || "-",
      Currency: row.client_currency || "-",
      Status: row.client_status || "Active",
      "Converted From Lead": row.lead_name || "-",
      "Created Date": formatDate(row.created_at),
    }));

    const headers = [
      "S.No",
      "Client ID",
      "Organization Name",
      "Contact Person",
      "Country",
      "State",
      "Currency",
      "Status",
      "Converted From Lead",
      "Created Date",
    ];

    const workbook = await createExcelWorkbook(
      transformedData,
      headers,
      "Clients",
      "CRM Clients Export",
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=clients_export.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting clients:", err);
    return res.status(500).json({ message: "Error exporting clients" });
  }
};

// 5. PROJECTS EXPORT
const exportProjects = async (req, res) => {
  const query = `
    SELECT
      p.project_id,
      p.uuid,
      p.project_name,
      p.project_description,
      p.project_category,
      p.project_status,
      p.project_priority,
      p.project_budget,
      p.onboarding_date,
      p.deadline_date,
      c.organisation_name AS client_name,
      p.created_at
    FROM crm_tbl_projects p
    LEFT JOIN crm_tbl_clients c
      ON p.client_id = c.client_id
    ORDER BY p.created_at DESC
  `;

  try {
    const [results] = await db.promise().query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "Empty records" });
    }

    // Transform data for Excel
    const transformedData = results.map((row, index) => ({
      "S.No": index + 1,
      "Project ID": row.project_id,
      "Project Name": row.project_name || "-",
      Description: row.project_description || "-",
      Category: row.project_category || "Tech",
      Status: row.project_status || "In Progress",
      Priority: row.project_priority || "High",
      Budget: row.project_budget
        ? `₹${row.project_budget.toLocaleString("en-IN")}`
        : "-",
      "Client Name": row.client_name || "-",
      "Onboarding Date": formatDate(row.onboarding_date),
      Deadline: formatDate(row.deadline_date),
      "Created Date": formatDate(row.created_at),
    }));

    const headers = [
      "S.No",
      "Project ID",
      "Project Name",
      "Description",
      "Category",
      "Status",
      "Priority",
      "Budget",
      "Client Name",
      "Onboarding Date",
      "Deadline",
      "Created Date",
    ];

    const workbook = await createExcelWorkbook(
      transformedData,
      headers,
      "Projects",
      "CRM Projects Export",
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=projects_export.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting projects:", err);
    return res.status(500).json({ message: "Error exporting projects" });
  }
};

// BONUS: ALL-IN-ONE CRM EXPORT
const exportAllCRMData = async (req, res) => {
  const query = `
    SELECT
      l.full_name AS lead_name,
      l.phone_number,
      l.email,
      c.organisation_name,
      p.project_name,
      p.project_status,
      f.followup_title,
      f.followup_datetime,
      f.followup_status
    FROM crm_tbl_leads l
    LEFT JOIN crm_tbl_clients c ON c.lead_id = l.lead_id
    LEFT JOIN crm_tbl_projects p ON p.client_id = c.client_id
    LEFT JOIN crm_tbl_followups f ON f.lead_id = l.lead_id
    ORDER BY l.created_at DESC
  `;

  try {
    const [results] = await db.promise().query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "Empty records" });
    }

    // Transform data for Excel
    const transformedData = results.map((row, index) => ({
      "S.No": index + 1,
      "Lead Name": row.lead_name || "-",
      Phone: row.phone_number || "-",
      Email: row.email || "-",
      Organization: row.organisation_name || "-",
      "Project Name": row.project_name || "-",
      "Project Status": row.project_status || "-",
      "Last Follow-up": row.followup_title || "-",
      "Follow-up Date": formatDateTime(row.followup_datetime),
      "Follow-up Status": row.followup_status || "-",
    }));

    const headers = [
      "S.No",
      "Lead Name",
      "Phone",
      "Email",
      "Organization",
      "Project Name",
      "Project Status",
      "Last Follow-up",
      "Follow-up Date",
      "Follow-up Status",
    ];

    const workbook = await createExcelWorkbook(
      transformedData,
      headers,
      "All CRM Data",
      "Complete CRM Data Export",
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=all_crm_data_export.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Error exporting all CRM data:", err);
    return res.status(500).json({ message: "Error exporting all CRM data" });
  }
};

module.exports = {
  exportEnquiries,
  exportLeads,
  exportFollowups,
  exportClients,
  exportProjects,
  exportAllCRMData,
};
