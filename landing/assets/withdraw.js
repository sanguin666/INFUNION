// "Withdraw from contract" (Seb, 30 Oct 2026): Spanish consumer law counts
// non-profits as consumers, so a place may withdraw within 14 days of its
// approval without a reason (TRLGDCU art. 102), and the EU wants it done
// online in two clicks: this page, then "Confirm withdrawal" (Directive
// 2023/2673). The email code proves it is the person who registered.
(function () {
  var STORAGE_KEY = "ansae-landing-language"; // shared with i18n.js

  var T = {
    en: {
      eyebrow: "Withdraw from contract",
      title: "Withdraw your place from infunion",
      lede: "Within 14 days of our approval, or at any time before it, you can withdraw from the contract without giving a reason. Nothing is due. Enter the email you registered with.",
      email: "Email", emailNote: "The one you registered the place with",
      sendCode: "Send me a code", resendCode: "Send a new code", codeSentTo: "Code sent to {email}",
      devCode: "Test server, no email sent: the code is {code}",
      reason: "Why are you leaving?", optional: "Optional, it helps us improve",
      cancel: "Cancel", confirm: "Confirm withdrawal", sending: "Sending…",
      doneTitle: "Your withdrawal is received",
      doneText: "We have received your withdrawal from the contract for {place} on {date}. A confirmation is on its way to {email}.",
      doneOpen: "Your dashboard is closed and its plan stopped within 2 working days.",
      backHome: "Back to infunion", privacy: "Privacy", terms: "Terms of use", withdrawLink: "Withdraw from contract",
      e_email: "Enter a valid email address.", e_code: "Enter the 6-digit code from the email.",
      e_nothing_to_withdraw: "We find no request or recent contract for this email to withdraw from. The 14 days may be over: write to hello@infunion.app.",
      e_codeWrong: "That code is not right, or it has expired. Ask for a new one.",
      e_wait: "Wait a moment before asking for another code.", e_network: "We could not reach infunion. Check your connection and try again.",
      e_generic: "Something went wrong. Try again, or write to hello@infunion.app.",
    },
    es: {
      eyebrow: "Desistir del contrato",
      title: "Retira tu lugar de infunion",
      lede: "En los 14 días siguientes a nuestra aprobación, o en cualquier momento antes, puedes desistir del contrato sin dar ningún motivo. No pagas nada. Escribe el email con el que registraste tu lugar.",
      email: "Email", emailNote: "Con el que registraste el lugar",
      sendCode: "Envíame un código", resendCode: "Enviar otro código", codeSentTo: "Código enviado a {email}",
      devCode: "Servidor de pruebas, no se envía email: el código es {code}",
      reason: "¿Por qué te vas?", optional: "Opcional, nos ayuda a mejorar",
      cancel: "Cancelar", confirm: "Confirmar el desistimiento", sending: "Enviando…",
      doneTitle: "Hemos recibido tu desistimiento",
      doneText: "Hemos recibido tu desistimiento del contrato de {place} el {date}. Te enviamos una confirmación a {email}.",
      doneOpen: "Cerramos tu panel y paramos su plan en 2 días laborables.",
      backHome: "Volver a infunion", privacy: "Privacidad", terms: "Condiciones de uso", withdrawLink: "Desistir del contrato",
      e_email: "Escribe un email válido.", e_code: "Escribe el código de 6 cifras del email.",
      e_nothing_to_withdraw: "No encontramos ninguna solicitud ni contrato reciente con este email. Puede que hayan pasado los 14 días: escribe a hello@infunion.app.",
      e_codeWrong: "El código no es correcto o ha caducado. Pide uno nuevo.",
      e_wait: "Espera un momento antes de pedir otro código.", e_network: "No hemos podido conectar con infunion. Revisa tu conexión y vuelve a intentarlo.",
      e_generic: "Algo ha fallado. Vuelve a intentarlo o escribe a hello@infunion.app.",
    },
    fr: {
      eyebrow: "Se rétracter du contrat",
      title: "Retirer votre lieu d’infunion",
      lede: "Dans les 14 jours suivant notre validation, ou à tout moment avant, vous pouvez vous rétracter du contrat sans donner de motif. Vous ne payez rien. Saisissez l’email avec lequel vous avez inscrit votre lieu.",
      email: "Email", emailNote: "Celui de l’inscription du lieu",
      sendCode: "Recevoir un code", resendCode: "Renvoyer un code", codeSentTo: "Code envoyé à {email}",
      devCode: "Serveur de test, aucun email envoyé : le code est {code}",
      reason: "Pourquoi partez-vous ?", optional: "Facultatif, cela nous aide à progresser",
      cancel: "Annuler", confirm: "Confirmer la rétractation", sending: "Envoi…",
      doneTitle: "Votre rétractation est bien reçue",
      doneText: "Nous avons bien reçu votre rétractation du contrat pour {place} le {date}. Une confirmation part vers {email}.",
      doneOpen: "Votre tableau de bord est fermé et son offre arrêtée sous 2 jours ouvrés.",
      backHome: "Retour à infunion", privacy: "Confidentialité", terms: "Conditions d'utilisation", withdrawLink: "Se rétracter du contrat",
      e_email: "Saisissez une adresse email valide.", e_code: "Saisissez le code à 6 chiffres reçu par email.",
      e_nothing_to_withdraw: "Nous ne trouvons aucune demande ni contrat récent pour cet email. Les 14 jours sont peut-être passés : écrivez à hello@infunion.app.",
      e_codeWrong: "Ce code n’est pas bon ou il a expiré. Demandez-en un nouveau.",
      e_wait: "Patientez un instant avant de demander un autre code.", e_network: "Impossible de joindre infunion. Vérifiez votre connexion et réessayez.",
      e_generic: "Une erreur est survenue. Réessayez ou écrivez à hello@infunion.app.",
    },
    va: {
      eyebrow: "Desistir del contracte",
      title: "Retira el teu lloc d’infunion",
      lede: "En els 14 dies següents a la nostra aprovació, o en qualsevol moment abans, pots desistir del contracte sense donar cap motiu. No pagues res. Escriu el correu amb què vas registrar el teu lloc.",
      email: "Correu electrònic", emailNote: "Amb el qual vas registrar el lloc",
      sendCode: "Envia’m un codi", resendCode: "Enviar un altre codi", codeSentTo: "Codi enviat a {email}",
      devCode: "Servidor de proves, no s’envia correu: el codi és {code}",
      reason: "Per què te’n vas?", optional: "Opcional, ens ajuda a millorar",
      cancel: "Cancel·lar", confirm: "Confirmar el desistiment", sending: "Enviant…",
      doneTitle: "Hem rebut el teu desistiment",
      doneText: "Hem rebut el teu desistiment del contracte de {place} el {date}. T’enviem una confirmació a {email}.",
      doneOpen: "Tanquem el teu panell i parem el seu pla en 2 dies laborables.",
      backHome: "Tornar a infunion", privacy: "Privacitat", terms: "Condicions d'ús", withdrawLink: "Desistir del contracte",
      e_email: "Escriu un correu vàlid.", e_code: "Escriu el codi de 6 xifres del correu.",
      e_nothing_to_withdraw: "No trobem cap sol·licitud ni contracte recent amb este correu. Potser ja han passat els 14 dies: escriu a hello@infunion.app.",
      e_codeWrong: "El codi no és correcte o ha caducat. Demana’n un de nou.",
      e_wait: "Espera un moment abans de demanar un altre codi.", e_network: "No hem pogut connectar amb infunion. Revisa la connexió i torna-ho a provar.",
      e_generic: "Alguna cosa ha fallat. Torna-ho a provar o escriu a hello@infunion.app.",
    },
    gl: {
      eyebrow: "Desistir do contrato",
      title: "Retira o teu lugar de infunion",
      lede: "Nos 14 días seguintes á nosa aprobación, ou en calquera momento antes, podes desistir do contrato sen dar ningún motivo. Non pagas nada. Escribe o email co que rexistraches o teu lugar.",
      email: "Email", emailNote: "Co que rexistraches o lugar",
      sendCode: "Envíame un código", resendCode: "Enviar outro código", codeSentTo: "Código enviado a {email}",
      devCode: "Servidor de probas, non se envía email: o código é {code}",
      reason: "Por que te vas?", optional: "Opcional, axúdanos a mellorar",
      cancel: "Cancelar", confirm: "Confirmar o desistimento", sending: "Enviando…",
      doneTitle: "Recibimos o teu desistimento",
      doneText: "Recibimos o teu desistimento do contrato de {place} o {date}. Enviámosche unha confirmación a {email}.",
      doneOpen: "Pechamos o teu panel e paramos o seu plan en 2 días laborables.",
      backHome: "Volver a infunion", privacy: "Privacidade", terms: "Condicións de uso", withdrawLink: "Desistir do contrato",
      e_email: "Escribe un email válido.", e_code: "Escribe o código de 6 cifras do email.",
      e_nothing_to_withdraw: "Non atopamos ningunha solicitude nin contrato recente con este email. Pode que xa pasasen os 14 días: escribe a hello@infunion.app.",
      e_codeWrong: "O código non é correcto ou caducou. Pide un novo.",
      e_wait: "Agarda un momento antes de pedir outro código.", e_network: "Non puidemos conectar con infunion. Revisa a conexión e téntao de novo.",
      e_generic: "Algo fallou. Téntao de novo ou escribe a hello@infunion.app.",
    },
    pt: {
      eyebrow: "Desistir do contrato",
      title: "Retire o seu local do infunion",
      lede: "Nos 14 dias seguintes à nossa aprovação, ou a qualquer momento antes, pode desistir do contrato sem indicar motivo. Não paga nada. Escreva o email com que registou o seu local.",
      email: "Email", emailNote: "O do registo do local",
      sendCode: "Enviar-me um código", resendCode: "Enviar outro código", codeSentTo: "Código enviado para {email}",
      devCode: "Servidor de testes, nenhum email enviado: o código é {code}",
      reason: "Porque está a sair?", optional: "Opcional, ajuda-nos a melhorar",
      cancel: "Cancelar", confirm: "Confirmar a desistência", sending: "A enviar…",
      doneTitle: "Recebemos a sua desistência",
      doneText: "Recebemos a sua desistência do contrato de {place} em {date}. Enviámos uma confirmação para {email}.",
      doneOpen: "Fechamos o seu painel e paramos o seu plano em 2 dias úteis.",
      backHome: "Voltar ao infunion", privacy: "Privacidade", terms: "Termos de utilização", withdrawLink: "Desistir do contrato",
      e_email: "Escreva um email válido.", e_code: "Escreva o código de 6 dígitos do email.",
      e_nothing_to_withdraw: "Não encontramos nenhum pedido nem contrato recente com este email. Os 14 dias podem já ter passado: escreva para hello@infunion.app.",
      e_codeWrong: "O código não está certo ou expirou. Peça um novo.",
      e_wait: "Aguarde um momento antes de pedir outro código.", e_network: "Não foi possível contactar o infunion. Verifique a ligação e tente de novo.",
      e_generic: "Algo correu mal. Tente de novo ou escreva para hello@infunion.app.",
    },
  };

  var lang = "es";
  var codeSent = false;

  function t(key, fields) {
    var text = (T[lang] && T[lang][key]) || T.en[key] || key;
    if (fields) {
      Object.keys(fields).forEach(function (name) {
        text = text.split("{" + name + "}").join(fields[name]);
      });
    }
    return text;
  }

  // The same API choice as register.js.
  function apiBase() {
    var override = new URLSearchParams(window.location.search).get("api");
    if (override && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override)) return override;
    var host = window.location.hostname;
    if (!host || host === "localhost" || host === "127.0.0.1" || /^192\.168\./.test(host)) {
      return "http://" + (host || "localhost") + ":3000";
    }
    if (host.indexOf("-staging") !== -1) return "https://infunion-api-staging.up.railway.app";
    return "https://infunion-api.up.railway.app";
  }

  function $(id) {
    return document.getElementById(id);
  }

  function email() {
    return $("wd-email").value.trim().toLowerCase();
  }

  function applyLang(next) {
    lang = T[next] ? next : "es";
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-r]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-r"));
    });
    document.querySelectorAll("[data-lang-select]").forEach(function (el) {
      el.value = lang;
    });
    $("wd-send-code").textContent = t(codeSent ? "resendCode" : "sendCode");
    if (codeSent) $("wd-code-label").textContent = t("codeSentTo", { email: email() });
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // Private browsing: the language just won't be remembered.
    }
  }

  function initialLang() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      saved = null;
    }
    return T[saved] ? saved : "es";
  }

  function ApiError(status, message) {
    this.status = status;
    this.message = message;
  }

  function post(path, body) {
    return fetch(apiBase() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .catch(function () {
        throw new ApiError(0, "network");
      })
      .then(function (response) {
        return response.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!response.ok) {
            var message = Array.isArray(data.message) ? data.message.join(" ") : data.message;
            throw new ApiError(response.status, message || "");
          }
          return data;
        });
      });
  }

  function describe(error) {
    if (!error || error.status === 0) return t("e_network");
    if (error.message === "nothing_to_withdraw") return t("e_nothing_to_withdraw");
    if (error.status === 429) return t("e_wait");
    if (error.status === 401 || /code/i.test(error.message)) return t("e_codeWrong");
    return t("e_generic");
  }

  function showError(text) {
    var el = document.querySelector("[data-error]");
    el.textContent = text || "";
    el.hidden = !text;
  }

  function sendCode() {
    showError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email())) {
      showError(t("e_email"));
      return;
    }
    var button = $("wd-send-code");
    button.disabled = true;
    post("/registrations/withdraw/code", { email: email(), language: lang })
      .then(function (result) {
        codeSent = true;
        $("wd-confirm").hidden = false;
        $("wd-submit").hidden = false;
        $("wd-code-label").textContent = t("codeSentTo", { email: email() });
        button.textContent = t("resendCode");
        var dev = $("wd-dev-code");
        dev.hidden = !result.devCode;
        if (result.devCode) dev.textContent = t("devCode", { code: result.devCode });
        $("wd-code").focus();
      })
      .catch(function (error) {
        showError(describe(error));
      })
      .then(function () {
        button.disabled = false;
      });
  }

  function confirmWithdrawal(event) {
    event.preventDefault();
    if (!codeSent) return;
    showError(null);
    var code = $("wd-code").value.trim();
    if (!/^\d{6}$/.test(code)) {
      showError(t("e_code"));
      return;
    }
    var button = $("wd-submit");
    button.disabled = true;
    button.textContent = t("sending");
    post("/registrations/withdraw", { email: email(), code: code, reason: $("wd-reason").value.trim() })
      .then(function (result) {
        var date = new Date().toLocaleDateString(lang === "va" ? "ca-ES" : lang, { day: "numeric", month: "long", year: "numeric" });
        $("wd-done-title").textContent = t("doneTitle");
        $("wd-done-text").textContent =
          t("doneText", { place: result.placeName, date: date, email: email() }) + (result.opened ? " " + t("doneOpen") : "");
        $("wd-ask").hidden = true;
        $("wd-done").hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch(function (error) {
        showError(describe(error));
      })
      .then(function () {
        button.disabled = false;
        button.textContent = t("confirm");
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyLang(initialLang());
    document.querySelectorAll("[data-lang-select]").forEach(function (el) {
      el.addEventListener("change", function () {
        applyLang(el.value);
      });
    });
    $("wd-send-code").addEventListener("click", sendCode);
    $("wd-form").addEventListener("submit", confirmWithdrawal);
  });
})();
