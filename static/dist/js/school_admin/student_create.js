const API_STUDENTS = "/api/pupils/students/";
const TOKEN = localStorage.getItem("access");

document.getElementById("studentForm").addEventListener("submit", async e => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  formData.append("status", "active");

  const res = await fetch(API_STUDENTS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`
    },
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json();
    console.error(errData);

    let errorMessage = "Une erreur est survenue lors de l'enregistrement.";
    
    if (errData.detail) {
      errorMessage = errData.detail;
    } else if (typeof errData === 'object') {
      errorMessage = Object.values(errData).flat().join(" | ");
    }

    const errorDiv = document.getElementById("form-error");
    errorDiv.textContent = errorMessage;
    errorDiv.classList.remove("hidden");
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.location.href = "students_list.html";
});