
async function apiRequest(url, method = "GET", body = null) {
    const token = localStorage.getItem("access_token");

    if (!token) {
        throw new Error("Utilisateur non connecté");
    }

    const options = {
        method,
        headers: {
            "Authorization": `Bearer ${token}`
        }
    };

    if (body) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Erreur serveur");
    }

    return data;
}

const fetchAPI = apiRequest;