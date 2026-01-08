const API_STUDENTS = "/api/pupils/students/";
const TOKEN = localStorage.getItem("access");

document.getElementById("studentForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  // Valeurs par défaut backend
  formData.append("status", "active");

  const res = await fetch(API_STUDENTS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`
    },
    body: formData
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(err);
    alert("Erreur création élève");
    return;
  }

  window.location.href = "students_list.html";
});
