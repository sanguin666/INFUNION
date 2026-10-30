// "Register your place" (Seb, 30 Oct 2026): the five-step form a place
// fills in to join infunion, replacing the email to hello@infunion.app.
// Plain script like the rest of this folder. Nothing it sends exists
// anywhere until the superadmin checks and approves it.
(function () {
  var STORAGE_KEY = "ansae-landing-language"; // shared with i18n.js
  var MAX_FILE = 10 * 1024 * 1024;
  var KINDS = [
    ["church", "#B8502E"],
    ["mosque", "#2E7D5B"],
    ["synagogue", "#3557A8"],
    ["other_worship", "#7A4FA0"],
    ["association", "#9A6A08"],
    ["culture", "#1F7A86"],
  ];
  var WORSHIP = ["church", "mosque", "synagogue", "other_worship"];
  var PRICES = { essentials: [39, 390], complete: [59, 590] };

  var T = {
    en: {
      eyebrow: "Register your place",
      title: "Bring your community to infunion",
      lede: "About 4 minutes. We check every place before opening it, so have a document that shows your place exists at hand.",
      step1: "Your place", step2: "You", step3: "Plan", step4: "Agreement", step5: "Sent",
      placeTitle: "Tell us about your place",
      searchLabel: "Is your place already on infunion?",
      searchPlaceholder: "Type its name",
      manage: "Ask to manage it",
      claimText: "You are asking to manage {name}. Fill in the details below so we can check it is you.",
      claimCancel: "It is another place",
      kindLabel: "Kind of place",
      k_church: "Church", k_mosque: "Mosque", k_synagogue: "Synagogue", k_other_worship: "Other place of worship", k_association: "Association", k_culture: "Culture, clubs, sports",
      placeName: "Name of the place", address: "Street address", postalCode: "Postal code", city: "Town or city", country: "Country", language: "Main language of the members",
      website: "Website or social page", optionalFaster: "Optional, helps us check faster",
      legalName: "Legal name", taxId: "Tax ID (CIF / NIF)",
      document: "Proof of the place", documentLimit: "PDF or photo, up to 10 MB",
      documentHint: "For example a registry certificate (associations, religious entities), the tax ID card, or a letter on the place's letterhead signed by its leader. Only infunion sees it, and it is deleted after the check.",
      continue: "Continue", back: "Back",
      youTitle: "Who will manage it?",
      firstName: "First name", lastName: "Last name", role: "Your role in the place", rolePlaceholder: "President, secretary, priest…",
      phone: "Phone", optional: "Optional", email: "Email", emailNote: "You will sign in with it",
      sendCode: "Send me a code", resendCode: "Send a new code", codeSentTo: "Code sent to {email}", checkCode: "Confirm",
      devCode: "Test server, no email sent: the code is {code}",
      emailOk: "Email confirmed.", emailOkAccount: "Email confirmed. You already have an infunion account: this place will be added to it.",
      planTitle: "Choose your plan", monthly: "Monthly", yearly: "Yearly, 2 months free",
      planHint: "First month free on Essentials and Complete. Nothing to pay today: we ask for payment details in your dashboard before the free month ends. You can change plan at any time.",
      perMonth: "/ month", perYear: "/ year", free: "Free", recommended: "Recommended",
      p_basic: "Basic", p_essentials: "Essentials", p_complete: "Complete",
      m_events: "Events and schedules", m_donations: "Donations", m_push: "Push notifications", m_announcements: "Announcements", m_requests: "Requests and appointments", m_messages: "Messages",
      m_all: "Everything in Essentials", m_community: "Community discussion", m_livestream: "Livestream", m_prayer: "Prayer requests", m_readings: "Daily readings", m_intentions: "Mass intentions",
      agreeTitle: "Review and agree",
      sumPlanFree: "Basic, free with no time limit.",
      sumPlanPaid: "{plan}, {price} after one free month. Cancel at any time.",
      sumAdmin: "Admin: {name}, {email}",
      acceptTerms: 'I accept the <a href="terms.html#places" target="_blank" rel="noopener">Terms of service for places</a>.',
      acceptDpa: 'I accept the <a href="dpa.html" target="_blank" rel="noopener">Data processing agreement</a>: infunion stores and handles our members\' data on our behalf, in Europe.',
      acceptReligious: "I understand that members' religious affiliation is sensitive data: infunion only uses it to run our place in the app, and each member agrees to it when joining.",
      authorised: "I am authorised to register this place and to sign for it.",
      signLabel: "Type your full name to sign", date: "Date",
      submit: "Send my request", sending: "Sending…",
      thanks: "Thank you, {first}. Your request is with us.",
      t1: "Request received", t1d: "Today. A copy of what you signed is in your inbox.",
      t2: "We check your place", t2d: "Usually within 2 working days. We may call or email you.",
      t3: "Your dashboard opens", t3d: "You get an email and sign in with {email}. Your free month, if any, starts that day.",
      backHome: "Back to infunion", privacy: "Privacy", terms: "Terms of use",
      privacyNote: "infunion uses these details only to check your place, open it and contact you about it. The proof document is deleted 90 days after our decision; the date, time and internet address of your signature are kept as proof of the agreement. Your rights (access, correction, deletion, objection) and how to complain to the data protection authority: <a href=\"privacy.html\" target=\"_blank\" rel=\"noopener\">Privacy</a>.",
      pcTitle: "Before you send",
      pc1: "Sending this form is a request, not yet a contract. Nothing is due today.",
      pc2: "The contract is concluded when we approve your place and tell you by email.",
      pc3: "We keep the signed agreement and email you a copy. It can be read in Spanish, English, Valencian, Galician, Portuguese and French.",
      pc4: "To correct anything, use Back before sending.",
      pc5: "You can withdraw within 14 days of approval, or at any time before it, without giving a reason, on the <a href=\"withdraw.html\" target=\"_blank\" rel=\"noopener\">withdrawal page</a>.",
      withdrawLink: "Withdraw from contract",
      e_required: "Fill in the highlighted fields.", e_kind: "Choose the kind of place.", e_codeFirst: "Confirm your email with the code first.",
      e_codeWrong: "That code is not right, or it has expired. Ask for a new one.",
      e_email_disposable: "Use a permanent email address: temporary inboxes are not accepted.",
      e_blocked: "We cannot accept a request from this email or tax ID. Write to hello@infunion.app.",
      e_already_pending: "There is already a request waiting with this email. We will be in touch soon.",
      e_tax_id_invalid: "This tax ID does not look right. Check it and try again.",
      e_document_required: "Add the proof document.", e_too_many_requests: "Too many requests from here today. Try again tomorrow.",
      e_email_not_confirmed: "Your email confirmation has expired. Go back to step 2 and ask for a new code.",
      e_religious_data_required: "Places of worship need to tick the religious data line.",
      e_place_not_found: "That place no longer exists. Choose it again or register a new one.",
      e_fileSize: "The document is larger than 10 MB.", e_fileType: "Send a PDF or a photo (JPG, PNG, HEIC).",
      e_wait: "Wait a moment before asking for another code.", e_network: "We could not reach infunion. Check your connection and try again.",
      e_generic: "Something went wrong. Try again, or write to hello@infunion.app.",
    },
    es: {
      eyebrow: "Registrar mi lugar",
      title: "Trae tu comunidad a infunion",
      lede: "Unos 4 minutos. Revisamos cada lugar antes de abrirlo, así que ten a mano un documento que demuestre que tu lugar existe.",
      step1: "Tu lugar", step2: "Tú", step3: "Plan", step4: "Acuerdo", step5: "Enviado",
      placeTitle: "Háblanos de tu lugar",
      searchLabel: "¿Tu lugar ya está en infunion?",
      searchPlaceholder: "Escribe su nombre",
      manage: "Pedir gestionarlo",
      claimText: "Pides gestionar {name}. Rellena los datos para que podamos comprobar que eres tú.",
      claimCancel: "Es otro lugar",
      kindLabel: "Tipo de lugar",
      k_church: "Iglesia", k_mosque: "Mezquita", k_synagogue: "Sinagoga", k_other_worship: "Otro lugar de culto", k_association: "Asociación", k_culture: "Cultura, clubes, deporte",
      placeName: "Nombre del lugar", address: "Dirección", postalCode: "Código postal", city: "Localidad", country: "País", language: "Idioma principal de los miembros",
      website: "Web o red social", optionalFaster: "Opcional, nos ayuda a revisar antes",
      legalName: "Nombre legal", taxId: "NIF / CIF",
      document: "Justificante del lugar", documentLimit: "PDF o foto, hasta 10 MB",
      documentHint: "Por ejemplo un certificado del registro (asociaciones, entidades religiosas), la tarjeta del NIF o una carta con membrete firmada por su responsable. Solo lo ve infunion y se borra tras la revisión.",
      continue: "Continuar", back: "Atrás",
      youTitle: "¿Quién lo gestionará?",
      firstName: "Nombre", lastName: "Apellidos", role: "Tu cargo en el lugar", rolePlaceholder: "Presidente, secretaria, párroco…",
      phone: "Teléfono", optional: "Opcional", email: "Correo electrónico", emailNote: "Entrarás con él",
      sendCode: "Enviarme un código", resendCode: "Enviar otro código", codeSentTo: "Código enviado a {email}", checkCode: "Confirmar",
      devCode: "Servidor de pruebas, no se envía correo: el código es {code}",
      emailOk: "Correo confirmado.", emailOkAccount: "Correo confirmado. Ya tienes una cuenta infunion: este lugar se añadirá a ella.",
      planTitle: "Elige tu plan", monthly: "Mensual", yearly: "Anual, 2 meses gratis",
      planHint: "Primer mes gratis en Essentials y Complete. Nada que pagar hoy: pedimos los datos de pago en tu panel antes de que acabe el mes gratuito. Puedes cambiar de plan cuando quieras.",
      perMonth: "/ mes", perYear: "/ año", free: "Gratis", recommended: "Recomendado",
      p_basic: "Basic", p_essentials: "Essentials", p_complete: "Complete",
      m_events: "Eventos y horarios", m_donations: "Donativos", m_push: "Notificaciones", m_announcements: "Anuncios", m_requests: "Solicitudes y citas", m_messages: "Mensajes",
      m_all: "Todo lo de Essentials", m_community: "Grupo de conversación", m_livestream: "Transmisión en vivo", m_prayer: "Peticiones de oración", m_readings: "Lecturas del día", m_intentions: "Intenciones de misa",
      agreeTitle: "Revisa y acepta",
      sumPlanFree: "Basic, gratis y sin límite de tiempo.",
      sumPlanPaid: "{plan}, {price} tras un mes gratis. Cancelable en cualquier momento.",
      sumAdmin: "Admin: {name}, {email}",
      acceptTerms: 'Acepto las <a href="terms.html#places" target="_blank" rel="noopener">Condiciones del servicio para lugares</a>.',
      acceptDpa: 'Acepto el <a href="dpa.html" target="_blank" rel="noopener">Acuerdo de tratamiento de datos</a>: infunion guarda y trata los datos de nuestros miembros por nuestra cuenta, en Europa.',
      acceptReligious: "Entiendo que la pertenencia religiosa de los miembros es un dato sensible: infunion solo la usa para llevar nuestro lugar en la aplicación y cada miembro la acepta al unirse.",
      authorised: "Estoy autorizado a registrar este lugar y a firmar en su nombre.",
      signLabel: "Escribe tu nombre completo para firmar", date: "Fecha",
      submit: "Enviar mi solicitud", sending: "Enviando…",
      thanks: "Gracias, {first}. Tu solicitud está con nosotros.",
      t1: "Solicitud recibida", t1d: "Hoy. Tienes una copia de lo firmado en tu correo.",
      t2: "Revisamos tu lugar", t2d: "Normalmente en 2 días laborables. Puede que te llamemos o te escribamos.",
      t3: "Se abre tu panel", t3d: "Recibes un correo y entras con {email}. Tu mes gratuito, si lo hay, empieza ese día.",
      backHome: "Volver a infunion", privacy: "Privacidad", terms: "Condiciones de uso",
      privacyNote: "infunion usa estos datos solo para revisar tu lugar, abrirlo y contactarte sobre él. El documento justificativo se borra 90 días después de nuestra decisión; la fecha, la hora y la dirección de internet de tu firma se guardan como prueba del acuerdo. Tus derechos (acceso, rectificación, supresión, oposición) y cómo reclamar ante la autoridad de protección de datos: <a href=\"privacy.html\" target=\"_blank\" rel=\"noopener\">Privacidad</a>.",
      pcTitle: "Antes de enviar",
      pc1: "Enviar este formulario es una solicitud, todavía no un contrato. Hoy no pagas nada.",
      pc2: "El contrato se celebra cuando aprobamos tu lugar y te lo comunicamos por email.",
      pc3: "Guardamos el acuerdo firmado y te enviamos una copia por email. Puede leerse en español, inglés, valenciano, gallego, portugués y francés.",
      pc4: "Para corregir algo, usa Atrás antes de enviar.",
      pc5: "Puedes desistir en los 14 días siguientes a la aprobación, o en cualquier momento antes, sin dar ningún motivo, en la <a href=\"withdraw.html\" target=\"_blank\" rel=\"noopener\">página de desistimiento</a>.",
      withdrawLink: "Desistir del contrato",
      e_required: "Rellena los campos marcados.", e_kind: "Elige el tipo de lugar.", e_codeFirst: "Confirma antes tu correo con el código.",
      e_codeWrong: "Ese código no es correcto o ha caducado. Pide otro.",
      e_email_disposable: "Usa un correo permanente: no aceptamos buzones temporales.",
      e_blocked: "No podemos aceptar una solicitud de este correo o NIF. Escribe a hello@infunion.app.",
      e_already_pending: "Ya hay una solicitud en espera con este correo. Te contactaremos pronto.",
      e_tax_id_invalid: "Este NIF no parece correcto. Revísalo y vuelve a intentarlo.",
      e_document_required: "Añade el justificante.", e_too_many_requests: "Demasiadas solicitudes desde aquí hoy. Inténtalo mañana.",
      e_email_not_confirmed: "La confirmación del correo ha caducado. Vuelve al paso 2 y pide otro código.",
      e_religious_data_required: "Los lugares de culto deben marcar la línea sobre datos religiosos.",
      e_place_not_found: "Ese lugar ya no existe. Elígelo de nuevo o registra uno nuevo.",
      e_fileSize: "El documento pesa más de 10 MB.", e_fileType: "Envía un PDF o una foto (JPG, PNG, HEIC).",
      e_wait: "Espera un momento antes de pedir otro código.", e_network: "No hemos podido conectar con infunion. Revisa tu conexión y vuelve a intentarlo.",
      e_generic: "Algo ha fallado. Vuelve a intentarlo o escribe a hello@infunion.app.",
    },
    fr: {
      eyebrow: "Inscrire mon lieu",
      title: "Amenez votre communauté sur infunion",
      lede: "Environ 4 minutes. Nous vérifions chaque lieu avant de l'ouvrir : gardez à portée de main un document qui prouve que votre lieu existe.",
      step1: "Votre lieu", step2: "Vous", step3: "Plan", step4: "Accord", step5: "Envoyé",
      placeTitle: "Parlez-nous de votre lieu",
      searchLabel: "Votre lieu est-il déjà sur infunion ?",
      searchPlaceholder: "Tapez son nom",
      manage: "Demander à le gérer",
      claimText: "Vous demandez à gérer {name}. Remplissez les informations pour que nous puissions vérifier que c'est bien vous.",
      claimCancel: "C'est un autre lieu",
      kindLabel: "Type de lieu",
      k_church: "Église", k_mosque: "Mosquée", k_synagogue: "Synagogue", k_other_worship: "Autre lieu de culte", k_association: "Association", k_culture: "Culture, clubs, sport",
      placeName: "Nom du lieu", address: "Adresse", postalCode: "Code postal", city: "Ville", country: "Pays", language: "Langue principale des membres",
      website: "Site ou page sociale", optionalFaster: "Facultatif, nous aide à vérifier plus vite",
      legalName: "Nom légal", taxId: "N° fiscal (SIREN, NIF…)",
      document: "Justificatif du lieu", documentLimit: "PDF ou photo, 10 Mo maximum",
      documentHint: "Par exemple un certificat d'enregistrement (associations, entités religieuses), la carte du numéro fiscal ou une lettre à en-tête signée par son responsable. Seul infunion le voit, et il est supprimé après la vérification.",
      continue: "Continuer", back: "Retour",
      youTitle: "Qui va le gérer ?",
      firstName: "Prénom", lastName: "Nom", role: "Votre rôle dans le lieu", rolePlaceholder: "Président, secrétaire, curé…",
      phone: "Téléphone", optional: "Facultatif", email: "E-mail", emailNote: "Vous vous connecterez avec",
      sendCode: "M'envoyer un code", resendCode: "Envoyer un nouveau code", codeSentTo: "Code envoyé à {email}", checkCode: "Confirmer",
      devCode: "Serveur de test, aucun e-mail envoyé : le code est {code}",
      emailOk: "E-mail confirmé.", emailOkAccount: "E-mail confirmé. Vous avez déjà un compte infunion : ce lieu y sera ajouté.",
      planTitle: "Choisissez votre plan", monthly: "Mensuel", yearly: "Annuel, 2 mois offerts",
      planHint: "Premier mois gratuit sur Essentials et Complete. Rien à payer aujourd'hui : nous demandons le moyen de paiement dans votre tableau de bord avant la fin du mois gratuit. Vous pouvez changer de plan à tout moment.",
      perMonth: "/ mois", perYear: "/ an", free: "Gratuit", recommended: "Recommandé",
      p_basic: "Basic", p_essentials: "Essentials", p_complete: "Complete",
      m_events: "Événements et horaires", m_donations: "Dons", m_push: "Notifications", m_announcements: "Annonces", m_requests: "Demandes et rendez-vous", m_messages: "Messages",
      m_all: "Tout Essentials", m_community: "Espace de discussion", m_livestream: "Diffusion en direct", m_prayer: "Intentions de prière", m_readings: "Lectures du jour", m_intentions: "Intentions de messe",
      agreeTitle: "Vérifiez et acceptez",
      sumPlanFree: "Basic, gratuit et sans limite de durée.",
      sumPlanPaid: "{plan}, {price} après un mois gratuit. Résiliable à tout moment.",
      sumAdmin: "Admin : {name}, {email}",
      acceptTerms: 'J\'accepte les <a href="terms.html#places" target="_blank" rel="noopener">Conditions de service pour les lieux</a>.',
      acceptDpa: 'J\'accepte l\'<a href="dpa.html" target="_blank" rel="noopener">Accord de traitement des données</a> : infunion conserve et traite les données de nos membres pour notre compte, en Europe.',
      acceptReligious: "Je comprends que l'appartenance religieuse des membres est une donnée sensible : infunion ne l'utilise que pour faire vivre notre lieu dans l'application, et chaque membre l'accepte en nous rejoignant.",
      authorised: "Je suis autorisé à inscrire ce lieu et à signer en son nom.",
      signLabel: "Tapez votre nom complet pour signer", date: "Date",
      submit: "Envoyer ma demande", sending: "Envoi…",
      thanks: "Merci, {first}. Votre demande est entre nos mains.",
      t1: "Demande reçue", t1d: "Aujourd'hui. Une copie de ce que vous avez signé est dans votre boîte mail.",
      t2: "Nous vérifions votre lieu", t2d: "En général sous 2 jours ouvrés. Nous pourrons vous appeler ou vous écrire.",
      t3: "Votre tableau de bord s'ouvre", t3d: "Vous recevez un e-mail et vous vous connectez avec {email}. Votre mois gratuit, le cas échéant, commence ce jour-là.",
      backHome: "Retour à infunion", privacy: "Confidentialité", terms: "Conditions d'utilisation",
      privacyNote: "infunion utilise ces informations uniquement pour vérifier votre lieu, l’ouvrir et vous contacter à son sujet. Le justificatif est supprimé 90 jours après notre décision ; la date, l’heure et l’adresse internet de votre signature sont conservées comme preuve de l’accord. Vos droits (accès, rectification, effacement, opposition) et comment saisir l’autorité de protection des données : <a href=\"privacy.html\" target=\"_blank\" rel=\"noopener\">Confidentialité</a>.",
      pcTitle: "Avant d’envoyer",
      pc1: "Envoyer ce formulaire est une demande, pas encore un contrat. Vous ne payez rien aujourd’hui.",
      pc2: "Le contrat est conclu quand nous validons votre lieu et vous le confirmons par email.",
      pc3: "Nous conservons l’accord signé et vous en envoyons une copie par email. Il est disponible en espagnol, anglais, valencien, galicien, portugais et français.",
      pc4: "Pour corriger quelque chose, utilisez Retour avant d’envoyer.",
      pc5: "Vous pouvez vous rétracter dans les 14 jours suivant la validation, ou à tout moment avant, sans donner de motif, sur la <a href=\"withdraw.html\" target=\"_blank\" rel=\"noopener\">page de rétractation</a>.",
      withdrawLink: "Se rétracter du contrat",
      e_required: "Remplissez les champs signalés.", e_kind: "Choisissez le type de lieu.", e_codeFirst: "Confirmez d'abord votre e-mail avec le code.",
      e_codeWrong: "Ce code n'est pas bon, ou il a expiré. Demandez-en un nouveau.",
      e_email_disposable: "Utilisez une adresse e-mail durable : les boîtes temporaires ne sont pas acceptées.",
      e_blocked: "Nous ne pouvons pas accepter de demande de cet e-mail ou de ce numéro fiscal. Écrivez à hello@infunion.app.",
      e_already_pending: "Une demande est déjà en attente avec cet e-mail. Nous revenons vers vous bientôt.",
      e_tax_id_invalid: "Ce numéro fiscal ne semble pas correct. Vérifiez-le et réessayez.",
      e_document_required: "Ajoutez le justificatif.", e_too_many_requests: "Trop de demandes depuis ici aujourd'hui. Réessayez demain.",
      e_email_not_confirmed: "La confirmation de l'e-mail a expiré. Revenez à l'étape 2 et demandez un nouveau code.",
      e_religious_data_required: "Les lieux de culte doivent cocher la ligne sur les données religieuses.",
      e_place_not_found: "Ce lieu n'existe plus. Choisissez-le à nouveau ou inscrivez-en un nouveau.",
      e_fileSize: "Le document dépasse 10 Mo.", e_fileType: "Envoyez un PDF ou une photo (JPG, PNG, HEIC).",
      e_wait: "Patientez un instant avant de demander un autre code.", e_network: "Impossible de joindre infunion. Vérifiez votre connexion et réessayez.",
      e_generic: "Une erreur est survenue. Réessayez, ou écrivez à hello@infunion.app.",
    },
    va: {
      eyebrow: "Registrar el meu lloc",
      title: "Porta la teua comunitat a infunion",
      lede: "Uns 4 minuts. Revisem cada lloc abans d'obrir-lo, així que tin a mà un document que demostre que el teu lloc existix.",
      step1: "El teu lloc", step2: "Tu", step3: "Pla", step4: "Acord", step5: "Enviat",
      placeTitle: "Parla'ns del teu lloc",
      searchLabel: "El teu lloc ja està en infunion?",
      searchPlaceholder: "Escriu el seu nom",
      manage: "Demanar gestionar-lo",
      claimText: "Demanes gestionar {name}. Ompli les dades perquè puguem comprovar que eres tu.",
      claimCancel: "És un altre lloc",
      kindLabel: "Tipus de lloc",
      k_church: "Església", k_mosque: "Mesquita", k_synagogue: "Sinagoga", k_other_worship: "Altre lloc de culte", k_association: "Associació", k_culture: "Cultura, clubs, esport",
      placeName: "Nom del lloc", address: "Adreça", postalCode: "Codi postal", city: "Localitat", country: "País", language: "Llengua principal dels membres",
      website: "Web o xarxa social", optionalFaster: "Opcional, ens ajuda a revisar abans",
      legalName: "Nom legal", taxId: "NIF / CIF",
      document: "Justificant del lloc", documentLimit: "PDF o foto, fins a 10 MB",
      documentHint: "Per exemple un certificat del registre (associacions, entitats religioses), la targeta del NIF o una carta amb capçalera signada pel seu responsable. Només el veu infunion i s'esborra després de la revisió.",
      continue: "Continuar", back: "Arrere",
      youTitle: "Qui el gestionarà?",
      firstName: "Nom", lastName: "Cognoms", role: "El teu càrrec en el lloc", rolePlaceholder: "President, secretària, rector…",
      phone: "Telèfon", optional: "Opcional", email: "Correu electrònic", emailNote: "Entraràs amb ell",
      sendCode: "Envia'm un codi", resendCode: "Enviar un altre codi", codeSentTo: "Codi enviat a {email}", checkCode: "Confirmar",
      devCode: "Servidor de proves, no s'envia correu: el codi és {code}",
      emailOk: "Correu confirmat.", emailOkAccount: "Correu confirmat. Ja tens un compte infunion: este lloc s'hi afegirà.",
      planTitle: "Tria el teu pla", monthly: "Mensual", yearly: "Anual, 2 mesos gratis",
      planHint: "Primer mes gratis en Essentials i Complete. Res a pagar hui: demanem les dades de pagament en el teu panell abans que acabe el mes gratuït. Pots canviar de pla quan vulgues.",
      perMonth: "/ mes", perYear: "/ any", free: "Gratis", recommended: "Recomanat",
      p_basic: "Basic", p_essentials: "Essentials", p_complete: "Complete",
      m_events: "Esdeveniments i horaris", m_donations: "Donatius", m_push: "Notificacions", m_announcements: "Anuncis", m_requests: "Sol·licituds i cites", m_messages: "Missatges",
      m_all: "Tot el d'Essentials", m_community: "Grup de conversa", m_livestream: "Retransmissió en directe", m_prayer: "Peticions d'oració", m_readings: "Lectures del dia", m_intentions: "Intencions de missa",
      agreeTitle: "Revisa i accepta",
      sumPlanFree: "Basic, gratis i sense límit de temps.",
      sumPlanPaid: "{plan}, {price} després d'un mes gratis. Cancel·lable en qualsevol moment.",
      sumAdmin: "Admin: {name}, {email}",
      acceptTerms: 'Accepte les <a href="terms.html#places" target="_blank" rel="noopener">Condicions del servici per a llocs</a>.',
      acceptDpa: 'Accepte l\'<a href="dpa.html" target="_blank" rel="noopener">Acord de tractament de dades</a>: infunion guarda i tracta les dades dels nostres membres per compte nostre, a Europa.',
      acceptReligious: "Entenc que la pertinença religiosa dels membres és una dada sensible: infunion només la utilitza per a portar el nostre lloc en l'aplicació i cada membre l'accepta en unir-se.",
      authorised: "Estic autoritzat a registrar este lloc i a signar en el seu nom.",
      signLabel: "Escriu el teu nom complet per a signar", date: "Data",
      submit: "Enviar la meua sol·licitud", sending: "Enviant…",
      thanks: "Gràcies, {first}. La teua sol·licitud està amb nosaltres.",
      t1: "Sol·licitud rebuda", t1d: "Hui. Tens una còpia del que has signat en el teu correu.",
      t2: "Revisem el teu lloc", t2d: "Normalment en 2 dies laborables. És possible que et cridem o t'escrivim.",
      t3: "S'obri el teu panell", t3d: "Reps un correu i entres amb {email}. El teu mes gratuït, si n'hi ha, comença eixe dia.",
      backHome: "Tornar a infunion", privacy: "Privacitat", terms: "Condicions d'ús",
      privacyNote: "infunion usa estes dades només per a revisar el teu lloc, obrir-lo i contactar amb tu sobre ell. El document justificatiu s’esborra 90 dies després de la nostra decisió; la data, l’hora i l’adreça d’internet de la teua signatura es guarden com a prova de l’acord. Els teus drets (accés, rectificació, supressió, oposició) i com reclamar davant l’autoritat de protecció de dades: <a href=\"privacy.html\" target=\"_blank\" rel=\"noopener\">Privacitat</a>.",
      pcTitle: "Abans d’enviar",
      pc1: "Enviar este formulari és una sol·licitud, encara no un contracte. Hui no pagues res.",
      pc2: "El contracte se celebra quan aprovem el teu lloc i t’ho comuniquem per email.",
      pc3: "Guardem l’acord signat i t’enviem una còpia per email. Es pot llegir en castellà, anglés, valencià, gallec, portugués i francés.",
      pc4: "Per a corregir alguna cosa, usa Arrere abans d’enviar.",
      pc5: "Pots desistir en els 14 dies següents a l’aprovació, o en qualsevol moment abans, sense donar cap motiu, en la <a href=\"withdraw.html\" target=\"_blank\" rel=\"noopener\">pàgina de desistiment</a>.",
      withdrawLink: "Desistir del contracte",
      e_required: "Ompli els camps marcats.", e_kind: "Tria el tipus de lloc.", e_codeFirst: "Confirma abans el teu correu amb el codi.",
      e_codeWrong: "Eixe codi no és correcte o ha caducat. Demana'n un altre.",
      e_email_disposable: "Usa un correu permanent: no acceptem bústies temporals.",
      e_blocked: "No podem acceptar una sol·licitud d'este correu o NIF. Escriu a hello@infunion.app.",
      e_already_pending: "Ja hi ha una sol·licitud en espera amb este correu. Et contactarem prompte.",
      e_tax_id_invalid: "Este NIF no pareix correcte. Revisa'l i torna-ho a intentar.",
      e_document_required: "Afig el justificant.", e_too_many_requests: "Massa sol·licituds des d'ací hui. Intenta-ho demà.",
      e_email_not_confirmed: "La confirmació del correu ha caducat. Torna al pas 2 i demana un altre codi.",
      e_religious_data_required: "Els llocs de culte han de marcar la línia sobre dades religioses.",
      e_place_not_found: "Eixe lloc ja no existix. Tria'l de nou o registra'n un de nou.",
      e_fileSize: "El document pesa més de 10 MB.", e_fileType: "Envia un PDF o una foto (JPG, PNG, HEIC).",
      e_wait: "Espera un moment abans de demanar un altre codi.", e_network: "No hem pogut connectar amb infunion. Revisa la connexió i torna-ho a intentar.",
      e_generic: "Alguna cosa ha fallat. Torna-ho a intentar o escriu a hello@infunion.app.",
    },
    gl: {
      eyebrow: "Rexistrar o meu lugar",
      title: "Trae a túa comunidade a infunion",
      lede: "Uns 4 minutos. Revisamos cada lugar antes de abrilo, así que ten a man un documento que demostre que o teu lugar existe.",
      step1: "O teu lugar", step2: "Ti", step3: "Plan", step4: "Acordo", step5: "Enviado",
      placeTitle: "Fálanos do teu lugar",
      searchLabel: "O teu lugar xa está en infunion?",
      searchPlaceholder: "Escribe o seu nome",
      manage: "Pedir xestionalo",
      claimText: "Pides xestionar {name}. Enche os datos para que poidamos comprobar que es ti.",
      claimCancel: "É outro lugar",
      kindLabel: "Tipo de lugar",
      k_church: "Igrexa", k_mosque: "Mesquita", k_synagogue: "Sinagoga", k_other_worship: "Outro lugar de culto", k_association: "Asociación", k_culture: "Cultura, clubs, deporte",
      placeName: "Nome do lugar", address: "Enderezo", postalCode: "Código postal", city: "Localidade", country: "País", language: "Lingua principal dos membros",
      website: "Web ou rede social", optionalFaster: "Opcional, axúdanos a revisar antes",
      legalName: "Nome legal", taxId: "NIF / CIF",
      document: "Xustificante do lugar", documentLimit: "PDF ou foto, ata 10 MB",
      documentHint: "Por exemplo un certificado do rexistro (asociacións, entidades relixiosas), a tarxeta do NIF ou unha carta con membrete asinada polo seu responsable. Só o ve infunion e bórrase tras a revisión.",
      continue: "Continuar", back: "Atrás",
      youTitle: "Quen o xestionará?",
      firstName: "Nome", lastName: "Apelidos", role: "O teu cargo no lugar", rolePlaceholder: "Presidente, secretaria, párroco…",
      phone: "Teléfono", optional: "Opcional", email: "Correo electrónico", emailNote: "Entrarás con el",
      sendCode: "Envíame un código", resendCode: "Enviar outro código", codeSentTo: "Código enviado a {email}", checkCode: "Confirmar",
      devCode: "Servidor de probas, non se envía correo: o código é {code}",
      emailOk: "Correo confirmado.", emailOkAccount: "Correo confirmado. Xa tes unha conta infunion: este lugar engadirase a ela.",
      planTitle: "Escolle o teu plan", monthly: "Mensual", yearly: "Anual, 2 meses gratis",
      planHint: "Primeiro mes gratis en Essentials e Complete. Nada que pagar hoxe: pedimos os datos de pagamento no teu panel antes de que remate o mes gratuíto. Podes cambiar de plan cando queiras.",
      perMonth: "/ mes", perYear: "/ ano", free: "Gratis", recommended: "Recomendado",
      p_basic: "Basic", p_essentials: "Essentials", p_complete: "Complete",
      m_events: "Eventos e horarios", m_donations: "Doazóns", m_push: "Notificacións", m_announcements: "Anuncios", m_requests: "Solicitudes e citas", m_messages: "Mensaxes",
      m_all: "Todo o de Essentials", m_community: "Grupo de conversa", m_livestream: "Retransmisión en directo", m_prayer: "Peticións de oración", m_readings: "Lecturas do día", m_intentions: "Intencións de misa",
      agreeTitle: "Revisa e acepta",
      sumPlanFree: "Basic, gratis e sen límite de tempo.",
      sumPlanPaid: "{plan}, {price} despois dun mes gratis. Cancelable en calquera momento.",
      sumAdmin: "Admin: {name}, {email}",
      acceptTerms: 'Acepto as <a href="terms.html#places" target="_blank" rel="noopener">Condicións do servizo para lugares</a>.',
      acceptDpa: 'Acepto o <a href="dpa.html" target="_blank" rel="noopener">Acordo de tratamento de datos</a>: infunion garda e trata os datos dos nosos membros por conta nosa, en Europa.',
      acceptReligious: "Entendo que a pertenza relixiosa dos membros é un dato sensible: infunion só a usa para levar o noso lugar na aplicación e cada membro acéptaa ao unirse.",
      authorised: "Estou autorizado a rexistrar este lugar e a asinar no seu nome.",
      signLabel: "Escribe o teu nome completo para asinar", date: "Data",
      submit: "Enviar a miña solicitude", sending: "Enviando…",
      thanks: "Grazas, {first}. A túa solicitude está connosco.",
      t1: "Solicitude recibida", t1d: "Hoxe. Tes unha copia do asinado no teu correo.",
      t2: "Revisamos o teu lugar", t2d: "Normalmente en 2 días laborables. Pode que te chamemos ou te escribamos.",
      t3: "Ábrese o teu panel", t3d: "Recibes un correo e entras con {email}. O teu mes gratuíto, se o hai, comeza ese día.",
      backHome: "Volver a infunion", privacy: "Privacidade", terms: "Condicións de uso",
      privacyNote: "infunion usa estes datos só para revisar o teu lugar, abrilo e contactar contigo sobre el. O documento xustificativo bórrase 90 días despois da nosa decisión; a data, a hora e o enderezo de internet da túa sinatura gárdanse como proba do acordo. Os teus dereitos (acceso, rectificación, supresión, oposición) e como reclamar ante a autoridade de protección de datos: <a href=\"privacy.html\" target=\"_blank\" rel=\"noopener\">Privacidade</a>.",
      pcTitle: "Antes de enviar",
      pc1: "Enviar este formulario é unha solicitude, aínda non un contrato. Hoxe non pagas nada.",
      pc2: "O contrato celébrase cando aprobamos o teu lugar e cho comunicamos por email.",
      pc3: "Gardamos o acordo asinado e enviámosche unha copia por email. Pódese ler en castelán, inglés, valenciano, galego, portugués e francés.",
      pc4: "Para corrixir algo, usa Atrás antes de enviar.",
      pc5: "Podes desistir nos 14 días seguintes á aprobación, ou en calquera momento antes, sen dar ningún motivo, na <a href=\"withdraw.html\" target=\"_blank\" rel=\"noopener\">páxina de desistimento</a>.",
      withdrawLink: "Desistir do contrato",
      e_required: "Enche os campos marcados.", e_kind: "Escolle o tipo de lugar.", e_codeFirst: "Confirma antes o teu correo co código.",
      e_codeWrong: "Ese código non é correcto ou caducou. Pide outro.",
      e_email_disposable: "Usa un correo permanente: non aceptamos caixas temporais.",
      e_blocked: "Non podemos aceptar unha solicitude deste correo ou NIF. Escribe a hello@infunion.app.",
      e_already_pending: "Xa hai unha solicitude en espera con este correo. Contactarémoste pronto.",
      e_tax_id_invalid: "Este NIF non parece correcto. Revísao e volve intentalo.",
      e_document_required: "Engade o xustificante.", e_too_many_requests: "Demasiadas solicitudes desde aquí hoxe. Inténtao mañá.",
      e_email_not_confirmed: "A confirmación do correo caducou. Volve ao paso 2 e pide outro código.",
      e_religious_data_required: "Os lugares de culto deben marcar a liña sobre datos relixiosos.",
      e_place_not_found: "Ese lugar xa non existe. Escólleo de novo ou rexistra un novo.",
      e_fileSize: "O documento pesa máis de 10 MB.", e_fileType: "Envía un PDF ou unha foto (JPG, PNG, HEIC).",
      e_wait: "Agarda un momento antes de pedir outro código.", e_network: "Non puidemos conectar con infunion. Revisa a conexión e volve intentalo.",
      e_generic: "Algo fallou. Volve intentalo ou escribe a hello@infunion.app.",
    },
    pt: {
      eyebrow: "Registar o meu local",
      title: "Traga a sua comunidade para o infunion",
      lede: "Cerca de 4 minutos. Verificamos cada local antes de o abrir, por isso tenha à mão um documento que prove que o seu local existe.",
      step1: "O seu local", step2: "Você", step3: "Plano", step4: "Acordo", step5: "Enviado",
      placeTitle: "Fale-nos do seu local",
      searchLabel: "O seu local já está no infunion?",
      searchPlaceholder: "Escreva o nome",
      manage: "Pedir para o gerir",
      claimText: "Pede para gerir {name}. Preencha os dados para podermos confirmar que é você.",
      claimCancel: "É outro local",
      kindLabel: "Tipo de local",
      k_church: "Igreja", k_mosque: "Mesquita", k_synagogue: "Sinagoga", k_other_worship: "Outro local de culto", k_association: "Associação", k_culture: "Cultura, clubes, desporto",
      placeName: "Nome do local", address: "Morada", postalCode: "Código postal", city: "Localidade", country: "País", language: "Língua principal dos membros",
      website: "Site ou rede social", optionalFaster: "Opcional, ajuda-nos a verificar mais depressa",
      legalName: "Nome legal", taxId: "NIF / NIPC",
      document: "Comprovativo do local", documentLimit: "PDF ou foto, até 10 MB",
      documentHint: "Por exemplo uma certidão de registo (associações, entidades religiosas), o cartão de contribuinte ou uma carta com timbre assinada pelo responsável. Só o infunion o vê, e é apagado após a verificação.",
      continue: "Continuar", back: "Voltar",
      youTitle: "Quem vai gerir?",
      firstName: "Nome próprio", lastName: "Apelidos", role: "O seu cargo no local", rolePlaceholder: "Presidente, secretária, pároco…",
      phone: "Telefone", optional: "Opcional", email: "Email", emailNote: "Vai entrar com ele",
      sendCode: "Enviar-me um código", resendCode: "Enviar outro código", codeSentTo: "Código enviado para {email}", checkCode: "Confirmar",
      devCode: "Servidor de testes, nenhum email enviado: o código é {code}",
      emailOk: "Email confirmado.", emailOkAccount: "Email confirmado. Já tem uma conta infunion: este local será adicionado.",
      planTitle: "Escolha o seu plano", monthly: "Mensal", yearly: "Anual, 2 meses grátis",
      planHint: "Primeiro mês grátis em Essentials e Complete. Nada a pagar hoje: pedimos os dados de pagamento no seu painel antes do fim do mês grátis. Pode mudar de plano a qualquer momento.",
      perMonth: "/ mês", perYear: "/ ano", free: "Grátis", recommended: "Recomendado",
      p_basic: "Basic", p_essentials: "Essentials", p_complete: "Complete",
      m_events: "Eventos e horários", m_donations: "Donativos", m_push: "Notificações", m_announcements: "Avisos", m_requests: "Pedidos e marcações", m_messages: "Mensagens",
      m_all: "Tudo do Essentials", m_community: "Grupo de conversa", m_livestream: "Transmissão em direto", m_prayer: "Pedidos de oração", m_readings: "Leituras do dia", m_intentions: "Intenções de missa",
      agreeTitle: "Reveja e aceite",
      sumPlanFree: "Basic, grátis e sem limite de tempo.",
      sumPlanPaid: "{plan}, {price} após um mês grátis. Cancelável a qualquer momento.",
      sumAdmin: "Admin: {name}, {email}",
      acceptTerms: 'Aceito os <a href="terms.html#places" target="_blank" rel="noopener">Termos de serviço para locais</a>.',
      acceptDpa: 'Aceito o <a href="dpa.html" target="_blank" rel="noopener">Acordo de tratamento de dados</a>: o infunion guarda e trata os dados dos nossos membros por nossa conta, na Europa.',
      acceptReligious: "Compreendo que a pertença religiosa dos membros é um dado sensível: o infunion só a usa para gerir o nosso local na aplicação e cada membro aceita-a ao juntar-se.",
      authorised: "Estou autorizado a registar este local e a assinar em seu nome.",
      signLabel: "Escreva o seu nome completo para assinar", date: "Data",
      submit: "Enviar o meu pedido", sending: "A enviar…",
      thanks: "Obrigado, {first}. O seu pedido está connosco.",
      t1: "Pedido recebido", t1d: "Hoje. Tem uma cópia do que assinou no seu email.",
      t2: "Verificamos o seu local", t2d: "Normalmente em 2 dias úteis. Podemos telefonar-lhe ou escrever-lhe.",
      t3: "O seu painel abre", t3d: "Recebe um email e entra com {email}. O seu mês grátis, se houver, começa nesse dia.",
      backHome: "Voltar ao infunion", privacy: "Privacidade", terms: "Termos de utilização",
      privacyNote: "O infunion usa estes dados apenas para verificar o seu local, abri-lo e contactá-lo sobre ele. O documento comprovativo é apagado 90 dias após a nossa decisão; a data, a hora e o endereço de internet da sua assinatura são guardados como prova do acordo. Os seus direitos (acesso, retificação, apagamento, oposição) e como reclamar junto da autoridade de proteção de dados: <a href=\"privacy.html\" target=\"_blank\" rel=\"noopener\">Privacidade</a>.",
      pcTitle: "Antes de enviar",
      pc1: "Enviar este formulário é um pedido, ainda não um contrato. Hoje não paga nada.",
      pc2: "O contrato é celebrado quando aprovamos o seu local e lho comunicamos por email.",
      pc3: "Guardamos o acordo assinado e enviamos-lhe uma cópia por email. Pode ser lido em espanhol, inglês, valenciano, galego, português e francês.",
      pc4: "Para corrigir algo, use Voltar antes de enviar.",
      pc5: "Pode desistir nos 14 dias seguintes à aprovação, ou a qualquer momento antes, sem indicar motivo, na <a href=\"withdraw.html\" target=\"_blank\" rel=\"noopener\">página de desistência</a>.",
      withdrawLink: "Desistir do contrato",
      e_required: "Preencha os campos assinalados.", e_kind: "Escolha o tipo de local.", e_codeFirst: "Confirme primeiro o seu email com o código.",
      e_codeWrong: "Esse código não está certo ou expirou. Peça outro.",
      e_email_disposable: "Use um email permanente: não aceitamos caixas temporárias.",
      e_blocked: "Não podemos aceitar um pedido deste email ou NIF. Escreva para hello@infunion.app.",
      e_already_pending: "Já existe um pedido em espera com este email. Entraremos em contacto em breve.",
      e_tax_id_invalid: "Este NIF não parece correto. Verifique e tente de novo.",
      e_document_required: "Adicione o comprovativo.", e_too_many_requests: "Demasiados pedidos a partir daqui hoje. Tente amanhã.",
      e_email_not_confirmed: "A confirmação do email expirou. Volte ao passo 2 e peça outro código.",
      e_religious_data_required: "Os locais de culto têm de marcar a linha sobre dados religiosos.",
      e_place_not_found: "Esse local já não existe. Escolha-o de novo ou registe um novo.",
      e_fileSize: "O documento tem mais de 10 MB.", e_fileType: "Envie um PDF ou uma foto (JPG, PNG, HEIC).",
      e_wait: "Aguarde um momento antes de pedir outro código.", e_network: "Não foi possível contactar o infunion. Verifique a ligação e tente de novo.",
      e_generic: "Algo correu mal. Tente de novo ou escreva para hello@infunion.app.",
    },
  };

  var lang = "es";
  var step = 1;
  var state = {
    emailToken: null,
    confirmedEmail: null,
    hasAccount: false,
    existingPoi: null,
  };

  function t(key, fields) {
    var text = (T[lang] && T[lang][key]) || T.en[key] || key;
    if (fields) {
      Object.keys(fields).forEach(function (name) {
        text = text.split("{" + name + "}").join(fields[name]);
      });
    }
    return text;
  }

  // The API next to this landing: production, staging, or the PC's own.
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

  function money(amount) {
    try {
      return new Intl.NumberFormat(lang === "va" ? "ca-ES" : lang === "pt" ? "pt-PT" : lang, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch (e) {
      return amount + " €";
    }
  }

  function value(id) {
    var el = $(id);
    return el ? el.value.trim() : "";
  }

  function chosen(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  // ---- words

  function applyLang(next) {
    lang = T[next] ? next : "es";
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-r]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-r"));
    });
    document.querySelectorAll("[data-r-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-r-html"));
    });
    document.querySelectorAll("[data-r-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-r-placeholder")));
    });
    document.querySelectorAll("[data-lang-select]").forEach(function (el) {
      el.value = lang;
    });
    renderKinds();
    renderPlans();
    renderClaim();
    renderSummary();
    renderEmailState();
    var date = $("reg-date");
    if (date) date.textContent = new Date().toLocaleDateString(lang === "va" ? "ca-ES" : lang, { day: "numeric", month: "long", year: "numeric" });
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
      // Fall back below.
    }
    return T[saved] ? saved : "es";
  }

  // ---- step 1

  function renderKinds() {
    var box = $("reg-kinds");
    var current = chosen("type");
    box.innerHTML = "";
    KINDS.forEach(function (kind) {
      var label = document.createElement("label");
      label.className = "reg-choice";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "type";
      input.value = kind[0];
      input.id = "reg-kind-" + kind[0];
      input.checked = current === kind[0];
      input.addEventListener("change", function () {
        renderPlans();
        renderSummary();
      });
      var dot = document.createElement("span");
      dot.className = "reg-dot";
      dot.style.background = kind[1];
      var text = document.createElement("span");
      text.textContent = t("k_" + kind[0]);
      label.appendChild(input);
      label.appendChild(dot);
      label.appendChild(text);
      box.appendChild(label);
    });
  }

  var searchTimer = null;
  function onSearch() {
    var q = value("reg-search");
    var list = $("reg-results");
    window.clearTimeout(searchTimer);
    if (q.length < 3) {
      list.hidden = true;
      return;
    }
    searchTimer = window.setTimeout(function () {
      fetch(apiBase() + "/map/places?limit=5&q=" + encodeURIComponent(q))
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (places) {
          list.innerHTML = "";
          (places || []).slice(0, 5).forEach(function (place) {
            var li = document.createElement("li");
            var info = document.createElement("span");
            var name = document.createElement("strong");
            name.textContent = place.name;
            var where = document.createElement("small");
            where.textContent = [t("k_" + place.type), place.city].filter(Boolean).join(" · ");
            info.appendChild(name);
            info.appendChild(where);
            var button = document.createElement("button");
            button.type = "button";
            button.className = "reg-link";
            button.textContent = t("manage");
            button.addEventListener("click", function () {
              claim(place);
            });
            li.appendChild(info);
            li.appendChild(button);
            list.appendChild(li);
          });
          list.hidden = list.children.length === 0;
        })
        .catch(function () {
          list.hidden = true;
        });
    }, 350);
  }

  function claim(place) {
    state.existingPoi = place;
    $("reg-placeName").value = place.name || "";
    if (place.address) $("reg-address").value = place.address;
    if (place.postalCode) $("reg-postalCode").value = place.postalCode;
    if (place.city) $("reg-city").value = place.city;
    var kind = document.getElementById("reg-kind-" + place.type);
    if (kind) kind.checked = true;
    $("reg-results").hidden = true;
    $("reg-search").value = "";
    renderClaim();
    renderPlans();
  }

  function renderClaim() {
    var box = $("reg-claim");
    if (!box) return;
    box.hidden = !state.existingPoi;
    if (state.existingPoi) $("reg-claim-text").textContent = t("claimText", { name: state.existingPoi.name });
  }

  // ---- step 2

  function renderEmailState() {
    var ok = $("reg-email-ok");
    if (!ok) return;
    ok.hidden = !state.emailToken;
    ok.textContent = state.hasAccount ? t("emailOkAccount") : t("emailOk");
    if (state.confirmedEmail) $("reg-code-label").textContent = t("codeSentTo", { email: state.confirmedEmail });
  }

  var pendingEmail = null;
  function sendCode() {
    var email = value("reg-email");
    var input = $("reg-email");
    var step2 = document.querySelector('[data-step="2"]');
    if (!input.checkValidity()) {
      input.closest(".reg-field").classList.add("invalid");
      showError(step2, t("e_required"));
      return;
    }
    showError(step2, "");
    var button = $("reg-send-code");
    button.disabled = true;
    post("/registrations/email/code", { email: email, language: lang })
      .then(function (result) {
        pendingEmail = email.toLowerCase();
        state.emailToken = null;
        state.confirmedEmail = null;
        $("reg-code-wrap").hidden = false;
        $("reg-code-label").textContent = t("codeSentTo", { email: email });
        button.textContent = t("resendCode");
        var dev = $("reg-dev-code");
        dev.hidden = !result.devCode;
        if (result.devCode) dev.textContent = t("devCode", { code: result.devCode });
        renderEmailState();
        $("reg-code").focus();
      })
      .catch(function (error) {
        showError(step2, describe(error));
      })
      .then(function () {
        button.disabled = false;
      });
  }

  function checkCode() {
    var step2 = document.querySelector('[data-step="2"]');
    var code = value("reg-code");
    if (!/^\d{6}$/.test(code)) {
      showError(step2, t("e_codeWrong"));
      return;
    }
    var button = $("reg-check-code");
    button.disabled = true;
    post("/registrations/email/verify", { email: pendingEmail, code: code })
      .then(function (result) {
        state.emailToken = result.emailToken;
        state.confirmedEmail = pendingEmail;
        state.hasAccount = !!result.hasAccount;
        $("reg-code-wrap").hidden = true;
        $("reg-dev-code").hidden = true;
        showError(step2, "");
        renderEmailState();
      })
      .catch(function (error) {
        showError(step2, error.status === 401 ? t("e_codeWrong") : describe(error));
      })
      .then(function () {
        button.disabled = false;
      });
  }

  // ---- step 3

  function modulesFor(plan, kind) {
    if (plan === "basic") return ["m_events", "m_donations"];
    if (plan === "essentials") return ["m_push", "m_announcements", "m_requests", "m_messages"];
    var list = ["m_all", "m_community", "m_livestream"];
    if (WORSHIP.indexOf(kind) !== -1) list.push("m_prayer", "m_readings");
    if (kind === "church") list.push("m_intentions");
    return list;
  }

  function renderPlans() {
    var box = $("reg-plans");
    if (!box) return;
    var current = chosen("plan") || new URLSearchParams(window.location.search).get("plan") || "essentials";
    var yearly = chosen("billingInterval") === "yearly";
    var kind = chosen("type");
    box.innerHTML = "";
    ["basic", "essentials", "complete"].forEach(function (plan) {
      var label = document.createElement("label");
      label.className = "reg-choice reg-plan";
      var input = document.createElement("input");
      input.type = "radio";
      input.name = "plan";
      input.value = plan;
      input.id = "reg-plan-" + plan;
      input.checked = current === plan;
      input.addEventListener("change", renderSummary);
      label.appendChild(input);
      if (plan === "essentials") {
        var reco = document.createElement("span");
        reco.className = "reg-reco";
        reco.textContent = t("recommended");
        label.appendChild(reco);
      }
      var name = document.createElement("strong");
      name.textContent = t("p_" + plan);
      label.appendChild(name);
      var price = document.createElement("span");
      price.className = "reg-price";
      if (plan === "basic") {
        price.textContent = t("free");
      } else {
        price.textContent = money(PRICES[plan][yearly ? 1 : 0]) + " ";
        var per = document.createElement("small");
        per.textContent = t(yearly ? "perYear" : "perMonth");
        price.appendChild(per);
      }
      label.appendChild(price);
      var ul = document.createElement("ul");
      modulesFor(plan, kind).forEach(function (key) {
        var li = document.createElement("li");
        li.textContent = t(key);
        ul.appendChild(li);
      });
      label.appendChild(ul);
      box.appendChild(label);
    });
  }

  // ---- step 4

  function renderSummary() {
    var box = $("reg-summary");
    if (!box) return;
    var plan = chosen("plan") || "essentials";
    var yearly = chosen("billingInterval") === "yearly";
    var kind = chosen("type");
    box.innerHTML = "";
    var title = document.createElement("strong");
    title.textContent = [value("reg-placeName"), kind ? t("k_" + kind) : "", value("reg-city")].filter(Boolean).join(" · ");
    var planLine = document.createElement("span");
    planLine.textContent =
      plan === "basic"
        ? t("sumPlanFree")
        : t("sumPlanPaid", {
            plan: t("p_" + plan),
            price: money(PRICES[plan][yearly ? 1 : 0]) + " " + t(yearly ? "perYear" : "perMonth"),
          });
    var admin = document.createElement("span");
    admin.className = "reg-hint";
    admin.textContent = t("sumAdmin", {
      name: [value("reg-firstName"), value("reg-lastName")].filter(Boolean).join(" "),
      email: state.confirmedEmail || value("reg-email"),
    });
    box.appendChild(title);
    box.appendChild(planLine);
    box.appendChild(admin);
    $("reg-religious-wrap").hidden = WORSHIP.indexOf(kind) === -1;
    $("reg-acceptReligiousData").required = WORSHIP.indexOf(kind) !== -1;
  }

  // ---- moving between steps

  function showError(stepEl, text) {
    var el = stepEl.querySelector("[data-error]");
    el.textContent = text;
    el.hidden = !text;
  }

  function validStep(n) {
    var stepEl = document.querySelector('[data-step="' + n + '"]');
    var ok = true;
    stepEl.querySelectorAll("input, select").forEach(function (input) {
      var field = input.closest(".reg-field");
      var bad = !input.checkValidity();
      if (field) field.classList.toggle("invalid", bad);
      if (bad && ok) {
        ok = false;
        input.focus();
      }
    });
    if (!ok) {
      showError(stepEl, t("e_required"));
      return false;
    }
    if (n === 1) {
      if (!chosen("type")) {
        showError(stepEl, t("e_kind"));
        return false;
      }
      var file = $("reg-document").files[0];
      if (file && file.size > MAX_FILE) {
        showError(stepEl, t("e_fileSize"));
        return false;
      }
    }
    if (n === 2 && (!state.emailToken || state.confirmedEmail !== value("reg-email").toLowerCase())) {
      showError(stepEl, t("e_codeFirst"));
      return false;
    }
    showError(stepEl, "");
    return true;
  }

  function go(n) {
    step = n;
    document.querySelectorAll("[data-step]").forEach(function (el) {
      el.hidden = Number(el.getAttribute("data-step")) !== n;
    });
    document.querySelectorAll("#reg-progress li").forEach(function (li, index) {
      li.className = index + 1 < n ? "done" : index + 1 === n ? "on" : "";
      if (index + 1 === n) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    if (n === 3) renderPlans();
    if (n === 4) {
      renderSummary();
      if (!value("reg-signedName")) $("reg-signedName").value = [value("reg-firstName"), value("reg-lastName")].join(" ").trim();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- talking to the API

  function ApiError(status, message) {
    this.status = status;
    this.message = message;
  }

  function handle(response) {
    return response
      .json()
      .catch(function () {
        return {};
      })
      .then(function (body) {
        if (!response.ok) {
          var message = Array.isArray(body.message) ? body.message[0] : body.message;
          throw new ApiError(response.status, message || "");
        }
        return body;
      });
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
      .then(handle);
  }

  function describe(error) {
    if (!error || error.status === 0) return t("e_network");
    var code = error.message;
    if (code && T.en["e_" + code]) return t("e_" + code);
    if (error.status === 415) return t("e_fileType");
    if (error.status === 413) return t("e_fileSize");
    if (error.status === 429) return /seconds/.test(code) ? t("e_wait") : t("e_too_many_requests");
    return t("e_generic");
  }

  function submit(event) {
    event.preventDefault();
    if (step !== 4 || !validStep(4)) return;
    var stepEl = document.querySelector('[data-step="4"]');
    var data = new FormData();
    data.append("emailToken", state.emailToken);
    data.append("homepage", value("reg-homepage"));
    if (state.existingPoi) data.append("existingPoiId", state.existingPoi.id);
    ["placeName", "address", "postalCode", "city", "country", "language", "website", "legalName", "taxId", "firstName", "lastName", "role", "phone", "signedName"].forEach(function (name) {
      data.append(name, value("reg-" + name));
    });
    data.append("type", chosen("type"));
    data.append("plan", chosen("plan"));
    data.append("billingInterval", chosen("billingInterval") || "monthly");
    data.append("acceptTerms", String($("reg-acceptTerms").checked));
    data.append("acceptDpa", String($("reg-acceptDpa").checked));
    data.append("authorised", String($("reg-authorised").checked));
    data.append("acceptReligiousData", String($("reg-acceptReligiousData").checked));
    data.append("document", $("reg-document").files[0]);

    var button = $("reg-submit");
    button.disabled = true;
    button.textContent = t("sending");
    fetch(apiBase() + "/registrations", { method: "POST", body: data })
      .catch(function () {
        throw new ApiError(0, "network");
      })
      .then(handle)
      .then(function () {
        $("reg-thanks").textContent = t("thanks", { first: value("reg-firstName") });
        $("reg-t3d").textContent = t("t3d", { email: state.confirmedEmail });
        go(5);
      })
      .catch(function (error) {
        showError(stepEl, describe(error));
      })
      .then(function () {
        button.disabled = false;
        button.textContent = t("submit");
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var plan = new URLSearchParams(window.location.search).get("plan");
    applyLang(initialLang());
    if (plan && $("reg-plan-" + plan)) $("reg-plan-" + plan).checked = true;
    $("reg-language").value = lang;
    document.querySelectorAll("[data-lang-select]").forEach(function (el) {
      el.addEventListener("change", function () {
        applyLang(el.value);
      });
    });
    $("reg-search").addEventListener("input", onSearch);
    $("reg-claim-cancel").addEventListener("click", function () {
      state.existingPoi = null;
      renderClaim();
    });
    $("reg-send-code").addEventListener("click", sendCode);
    $("reg-check-code").addEventListener("click", checkCode);
    $("reg-code").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        checkCode();
      }
    });
    $("reg-email").addEventListener("input", function () {
      if (state.confirmedEmail && value("reg-email").toLowerCase() !== state.confirmedEmail) {
        state.emailToken = null;
        state.confirmedEmail = null;
        renderEmailState();
      }
    });
    document.querySelectorAll('input[name="billingInterval"]').forEach(function (input) {
      input.addEventListener("change", function () {
        renderPlans();
        renderSummary();
      });
    });
    document.querySelectorAll("[data-next]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (validStep(step)) go(step + 1);
      });
    });
    document.querySelectorAll("[data-back]").forEach(function (button) {
      button.addEventListener("click", function () {
        go(step - 1);
      });
    });
    $("reg-form").addEventListener("submit", submit);
    go(1);
  });
})();
