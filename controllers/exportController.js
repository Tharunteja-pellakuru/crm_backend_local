const db = require("../config/db.js");
const pool = db.promise;
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
      e.enquiry_id,
      e.uuid,
      e.full_name,
      e.email,
      e.phone_number,
      e.website_url,
      e.message,
      e.status,
      e.remarks,
      e.created_at,
      e.updated_at,
      a1.full_name AS created_by_name,
      a2.full_name AS updated_by_name
    FROM crm_tbl_enquiries e
    LEFT JOIN crm_tbl_admins a1 ON e.created_by = a1.admin_id
    LEFT JOIN crm_tbl_admins a2 ON e.updated_by = a2.admin_id
    ORDER BY e.created_at DESC
  `;

  try {
    const [results] = await pool.query(query);

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
      "Created Date": formatDateTime(row.created_at),
      "Updated Date": formatDateTime(row.updated_at),
      "Created By": row.created_by_name || "System",
      "Updated By": row.updated_by_name || "-",
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
      "Updated Date",
      "Created By",
      "Updated By",
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
      l.country_code,
      e.enquiry_id,
      e.status AS enquiry_status,
      l.created_at,
      l.updated_at,
      a1.full_name AS created_by_name,
      a2.full_name AS updated_by_name
    FROM crm_tbl_leads l
    LEFT JOIN crm_tbl_enquiries e ON l.enquiry_id = e.enquiry_id
    LEFT JOIN crm_tbl_admins a1 ON l.created_by = a1.admin_id
    LEFT JOIN crm_tbl_admins a2 ON l.updated_by = a2.admin_id
    ORDER BY l.created_at DESC
  `;

  try {
    const [results] = await pool.query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "Empty records" });
    }

    // Transform data for Excel
    const transformedData = results.map((row, index) => ({
      "S.No": index + 1,
      "Lead ID": row.lead_id,
      Name: row.full_name || "-",
      Phone: row.phone_number || "-",
      "Country Code": row.country_code || "-",
      Email: row.email || "-",
      "Lead Status": row.lead_status || "-",
      Category: row.lead_category === 1 ? "Tech" : row.lead_category === 2 ? "Social Media" : "Both",
      "Lead Source": row.enquiry_id ? "Enquiry" : "Manual",
      "Enquiry Status": row.enquiry_status || "-",
      Website: row.website_url || "-",
      Message: row.message || "-",
      "Created Date": formatDateTime(row.created_at),
      "Updated Date": formatDateTime(row.updated_at),
      "Created By": row.created_by_name || "System",
      "Updated By": row.updated_by_name || "-",
    }));

    const headers = [
      "S.No",
      "Lead ID",
      "Name",
      "Phone",
      "Country Code",
      "Email",
      "Lead Status",
      "Category",
      "Lead Source",
      "Enquiry Status",
      "Website",
      "Message",
      "Created Date",
      "Updated Date",
      "Created By",
      "Updated By",
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
      f.followup_id,
      f.followup_title,
      f.followup_description,
      f.followup_datetime,
      f.followup_mode,
      f.followup_status,
      f.followup_priority,
      f.created_at,
      f.updated_at,
      -- Lead details
      l.full_name AS lead_name,
      l.phone_number AS lead_phone,
      l.email AS lead_email,
      -- Project \u0026 Client details
      p.project_name,
      c.organisation_name AS client_org,
      c.client_name AS client_person,
      -- Summary \u0026 Audit
      s.conclusion_message,
      s.completed_at,
      a1.full_name AS created_by_name,
      a2.full_name AS updated_by_name
    FROM crm_tbl_followups f
    LEFT JOIN crm_tbl_leads l ON f.lead_id = l.lead_id
    LEFT JOIN crm_tbl_projects p ON f.project_id = p.project_id
    LEFT JOIN crm_tbl_clients c ON p.client_id = c.client_id
    LEFT JOIN crm_tbl_followUpSummary s ON f.followup_id = s.followup_id
    LEFT JOIN crm_tbl_admins a1 ON f.created_by = a1.admin_id
    LEFT JOIN crm_tbl_admins a2 ON f.updated_by = a2.admin_id
    ORDER BY f.followup_datetime DESC
  `;

  try {
    const [results] = await pool.query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "Empty records" });
    }

    // Transform data for Excel
    const transformedData = results.map((row, index) => ({
      "S.No": index + 1,
      "Follow-up ID": row.followup_id,
      "Context": row.project_name ? "Project" : "Lead",
      "Title": row.followup_title || "-",
      "Description": row.followup_description || "-",
      
      // Respective Details
      "Lead Name": row.lead_name || "-",
      "Lead Phone": row.lead_phone || "-",
      "Lead Email": row.lead_email || "-",
      "Project Name": row.project_name || "-",
      "Client Organization": row.client_org || "-",
      "Contact Person": row.client_person || "-",
      
      // Status \u0026 Priority
      "Scheduled Date \u0026 Time": formatDateTime(row.followup_datetime),
      "Mode": row.followup_mode || "-",
      "Status": row.followup_status || "Pending",
      "Priority": row.followup_priority || "Medium",
      
      // Result
      "Conclusion": row.conclusion_message || "-",
      "Completed At": formatDateTime(row.completed_at),
      
      // Audit
      "Created Date": formatDateTime(row.created_at),
      "Updated Date": formatDateTime(row.updated_at),
      "Created By": row.created_by_name || "System",
      "Updated By": row.updated_by_name || "-",
    }));

    const headers = [
      "S.No",
      "Follow-up ID",
      "Context",
      "Title",
      "Description",
      "Lead Name",
      "Lead Phone",
      "Lead Email",
      "Project Name",
      "Client Organization",
      "Contact Person",
      "Scheduled Date \u0026 Time",
      "Mode",
      "Status",
      "Priority",
      "Conclusion",
      "Completed At",
      "Created Date",
      "Updated Date",
      "Created By",
      "Updated By",
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
      c.created_at,
      c.updated_at,
      a1.full_name AS created_by_name,
      a2.full_name AS updated_by_name
    FROM crm_tbl_clients c
    LEFT JOIN crm_tbl_leads l ON c.lead_id = l.lead_id
    LEFT JOIN crm_tbl_admins a1 ON c.created_by = a1.admin_id
    LEFT JOIN crm_tbl_admins a2 ON c.updated_by = a2.admin_id
    ORDER BY c.created_at DESC
  `;

  try {
    const [results] = await pool.query(query);

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
      "Created Date": formatDateTime(row.created_at),
      "Updated Date": formatDateTime(row.updated_at),
      "Created By": row.created_by_name || "System",
      "Updated By": row.updated_by_name || "-",
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
      "Updated Date",
      "Created By",
      "Updated By",
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
      p.scope_document,
      c.organisation_name AS client_name,
      p.created_at,
      p.updated_at,
      a1.full_name AS created_by_name,
      a2.full_name AS updated_by_name
    FROM crm_tbl_projects p
    LEFT JOIN crm_tbl_clients c ON p.client_id = c.client_id
    LEFT JOIN crm_tbl_admins a1 ON p.created_by = a1.admin_id
    LEFT JOIN crm_tbl_admins a2 ON p.updated_by = a2.admin_id
    ORDER BY p.created_at DESC
  `;

  try {
    const [results] = await pool.query(query);

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
      "Scope Document": row.scope_document ? row.scope_document.split('/').pop() : "-",
      "Created Date": formatDateTime(row.created_at),
      "Updated Date": formatDateTime(row.updated_at),
      "Created By": row.created_by_name || "System",
      "Updated By": row.updated_by_name || "-",
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
      "Scope Document",
      "Created Date",
      "Updated Date",
      "Created By",
      "Updated By",
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
    const [results] = await pool.query(query);

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
