const API_URL = "http://localhost:8000/api/pupils/students/";
const token = localStorage.getItem("access_token");

if (!token) {
  window.location.href = "/static/dist/html/login.html";
}

const headers = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`
});

const table = document.getElementById("studentsTable");

if (table) {
  fetch(API_URL, { headers: headers() })
    .then(res => res.json())
    .then(data => {
      table.innerHTML = "";
      data.results.forEach(s => {
        table.innerHTML += `
          <tr>
            <td class="px-4 py-3 font-medium">${s.full_name}</td>
            <td class="px-4 py-3">${s.current_classe || "-"}</td>
            <td class="px-4 py-3">${s.status}</td>
            <td class="px-4 py-3 text-right space-x-2">
              <a href="student_form.html?id=${s.id}"
                 class="text-indigo-600 hover:underline">Modifier</a>
              <button onclick="deleteStudent(${s.id})"
                      class="text-red-600 hover:underline">Supprimer</button>
            </td>
          </tr>`;
      });
    });
}

function deleteStudent(id) {
  if (!confirm("Supprimer cet élève ?")) return;

  fetch(API_URL + id + "/", {
    method: "DELETE",
    headers: headers()
  }).then(() => location.reload());
}

const form = document.getElementById("studentForm");

if (form) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (id) {
    fetch(API_URL + id + "/", { headers: headers() })
      .then(res => res.json())
      .then(data => {
        document.getElementById("formTitle").innerText = "Modifier élève";
        document.getElementById("studentId").value = data.id;

        for (const key in data) {
          const field = document.getElementById(key);
          if (field && data[key] !== null) {
            field.value = data[key];
          }
        }

        if (data.profile_picture) {
          document.getElementById("photoPreview").src = data.profile_picture;
        }
      });
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const formData = new FormData();
    const fields = ["last_name", "middle_name", "first_name", "date_of_birth", "gender", "phone_number", "email", "student_id_code", "status"];
    
    fields.forEach(fieldId => {
        const el = document.getElementById(fieldId);
        if (el && el.value) formData.append(fieldId, el.value);
    });

    const photo = document.getElementById("profile_picture").files[0];
    if (photo) formData.append("profile_picture", photo);

    const method = id ? "PUT" : "POST";
    const url = id ? (API_URL.endsWith('/') ? API_URL + id + "/" : API_URL + "/" + id + "/") : API_URL;

    try {
        const res = await fetch(url, {
            method: method,
            headers: {
                
                "Authorization": `Bearer ${localStorage.getItem("access_token")}` 
            },
            body: formData
        });

        if (res.status === 401) {
            alert("Votre session a expiré. Veuillez vous reconnecter.");
            window.location.href = "/static/dist/html/login.html";
            return;
        }

        if (!res.ok) {
            const err = await res.json();
            console.error("Détails erreur:", err);
            alert("Erreur : " + JSON.stringify(err));
            return;
        }

        window.location.href = "students_list.html";
    } catch (error) {
        console.error("Erreur réseau:", error);
    }
});


async function loadClasses() {
  const res = await fetch("/api/academia/classes/", {
    headers: headers()
  });
  const data = await res.json();

  const select = document.getElementById("classFilter");
  data.results.forEach(c => {
    select.innerHTML += `
      <option value="${c.id}">${c.name}</option>
    `;
  });
}
