// KUKUMBER MESSENGER - SETTINGS (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ)
// Все функции: профиль, уведомления, темы, язык, оформление

var translations = {
    ru: {
        app_name: 'K Messenger', settings: 'Настройки', edit_profile: 'Редактировать профиль',
        username: 'Отображаемое имя', about_me: 'О себе', save: 'Сохранить',
        notifications: 'Уведомления', privacy: 'Конфиденциальность', theme: 'Оформление',
        language: 'Язык', storage: 'Данные и память', about: 'О приложении', help: 'Помощь',
        logout: 'Выйти из аккаунта', version: 'v1.0', tagline: 'Свежее общение каждый день 🥒',
        select_language: 'Выберите язык', settings_saved: 'Настройки сохранены',
        profile_updated: 'Профиль обновлён', enter_username: 'Введите отображаемое имя',
        in_development: 'в разработке', phone: 'Телефон', online: 'В сети', offline: 'Не в сети',
        chats: 'Чаты', reels: 'Слайсы', new_chat: 'Чат', new_group: 'Группа', new_channel: 'Канал',
        search_placeholder: '🔍 Поиск по чатам...', select_chat: 'Выберите чат',
        create_group: 'Создать группу', create_channel: 'Создать канал',
        group_name: 'Название группы', channel_name: 'Название канала',
        channel_link: 'Ссылка (например: mychannel)', public: 'Публичный', private: 'Приватный',
        description: 'Описание', members: 'Участники', subscribers: 'Подписчики',
        add_members: 'Добавить участников', add_members_placeholder: 'Поиск...',
        leave_chat: 'Покинуть', delete_chat: 'Удалить', subscribe: 'Подписаться',
        unsubscribe: 'Отписаться', message_placeholder: 'Сообщение...', send: 'Отправить',
        attach_file: 'Прикрепить файл', voice_message: 'Голосовое сообщение', emoji: 'Эмодзи',
        create_reel: 'Создать слайс', reel_caption: 'Описание...', allow_comments: 'Разрешить комментарии',
        publish: 'Опубликовать', feed: 'Лента', my_reels: 'Мои', liked_reels: 'Понравилось',
        no_reels: 'Пока нет слайсов', be_first: 'Будьте первым!', voice_call: 'Аудиозвонок',
        video_call: 'Видеозвонок', call_only_private: 'Звонки только в личных чатах',
        user_unavailable: 'Пользователь недоступен', calling: 'Вызов...', connected: 'Подключено',
        mute: 'Отключить звук', unmute: 'Включить звук', close: 'Закрыть', confirm: 'Подтвердить',
        cancel: 'Отмена', yes: 'Да', no: 'Нет', ok: 'Хорошо', error: 'Ошибка', success: 'Успешно',
        loading: 'Загрузка...', participants: 'Участники', you: 'Вы', admin: 'админ', owner: 'владелец',
        join: 'Присоединиться', find_users: 'Найти', add_to_contacts: 'Добавить в контакты',
        contacts: 'Контакты', no_contacts: 'Нет контактов', global_search: 'Поиск пользователей',
        search_users_placeholder: 'Имя пользователя', delete_for_me: 'Удалить у меня',
        delete_for_everyone: 'Удалить у всех', edit_message: 'Редактировать', add_reaction: 'Поставить реакцию',
        pin_message: 'Закрепить', forward_message: 'Переслать', select_recipients: 'Выберите получателей (макс. 5)',
        max_recipients: 'Максимум 5 получателей', typing: 'печатает...', recording: 'запись...',
        sending_photo: 'отправляет фото...', no_messages: 'Нет сообщений', next: 'Далее', back: 'Назад'
    },
    en: {
        app_name: 'K Messenger', settings: 'Settings', edit_profile: 'Edit Profile',
        username: 'Display Name', about_me: 'About me', save: 'Save', notifications: 'Notifications',
        privacy: 'Privacy', theme: 'Theme', language: 'Language', storage: 'Storage',
        about: 'About', help: 'Help', logout: 'Logout', version: 'v1.0',
        tagline: 'Fresh communication every day 🥒', select_language: 'Select language',
        settings_saved: 'Settings saved', profile_updated: 'Profile updated',
        enter_username: 'Enter display name', in_development: 'in development', phone: 'Phone',
        online: 'Online', offline: 'Offline', chats: 'Chats', reels: 'Slices', new_chat: 'Chat',
        new_group: 'Group', new_channel: 'Channel', search_placeholder: '🔍 Search chats...',
        select_chat: 'Select a chat', create_group: 'Create group', create_channel: 'Create channel',
        group_name: 'Group name', channel_name: 'Channel name', channel_link: 'Link (e.g., mychannel)',
        public: 'Public', private: 'Private', description: 'Description', members: 'Members',
        subscribers: 'Subscribers', add_members: 'Add members', add_members_placeholder: 'Search...',
        leave_chat: 'Leave', delete_chat: 'Delete', subscribe: 'Subscribe', unsubscribe: 'Unsubscribe',
        message_placeholder: 'Message...', send: 'Send', attach_file: 'Attach file',
        voice_message: 'Voice message', emoji: 'Emoji', create_reel: 'Create slice',
        reel_caption: 'Caption...', allow_comments: 'Allow comments', publish: 'Publish',
        feed: 'Feed', my_reels: 'My', liked_reels: 'Liked', no_reels: 'No slices yet',
        be_first: 'Be the first!', voice_call: 'Voice call', video_call: 'Video call',
        call_only_private: 'Calls only in private chats', user_unavailable: 'User unavailable',
        calling: 'Calling...', connected: 'Connected', mute: 'Mute', unmute: 'Unmute',
        close: 'Close', confirm: 'Confirm', cancel: 'Cancel', yes: 'Yes', no: 'No', ok: 'OK',
        error: 'Error', success: 'Success', loading: 'Loading...', participants: 'Participants',
        you: 'You', admin: 'admin', owner: 'owner', join: 'Join', find_users: 'Find',
        add_to_contacts: 'Add to contacts', contacts: 'Contacts',
        no_contacts: 'No contacts', global_search: 'Search users',
        search_users_placeholder: 'Username', delete_for_me: 'Delete for me',
        delete_for_everyone: 'Delete for everyone', edit_message: 'Edit', add_reaction: 'Add reaction',
        pin_message: 'Pin', forward_message: 'Forward', select_recipients: 'Select recipients (max 5)',
        max_recipients: 'Maximum 5 recipients', typing: 'typing...', recording: 'recording...',
        sending_photo: 'sending photo...', no_messages: 'No messages', next: 'Next', back: 'Back'
    },
    es: {
        app_name: 'K Messenger', settings: 'Ajustes', edit_profile: 'Editar perfil',
        username: 'Nombre de usuario', about_me: 'Sobre mí', save: 'Guardar',
        notifications: 'Notificaciones', privacy: 'Privacidad', theme: 'Tema',
        language: 'Idioma', storage: 'Almacenamiento', about: 'Acerca de', help: 'Ayuda',
        logout: 'Cerrar sesión', version: 'v1.0', tagline: 'Comunicación fresca cada día 🥒',
        select_language: 'Seleccionar idioma', settings_saved: 'Configuración guardada',
        profile_updated: 'Perfil actualizado', enter_username: 'Ingrese nombre de usuario',
        in_development: 'en desarrollo', phone: 'Teléfono', online: 'En línea', offline: 'Desconectado',
        chats: 'Charlas', reels: 'Slices', new_chat: 'Chat', new_group: 'Grupo', new_channel: 'Canal',
        search_placeholder: '🔍 Buscar chats...', select_chat: 'Selecciona un chat',
        create_group: 'Crear grupo', create_channel: 'Crear canal',
        group_name: 'Nombre del grupo', channel_name: 'Nombre del canal',
        channel_link: 'Enlace (ej: micanal)', public: 'Público', private: 'Privado',
        description: 'Descripción', members: 'Miembros', subscribers: 'Suscriptores',
        add_members: 'Añadir miembros', add_members_placeholder: 'Buscar...',
        leave_chat: 'Abandonar', delete_chat: 'Eliminar', subscribe: 'Suscribirse',
        unsubscribe: 'Darse de baja', message_placeholder: 'Mensaje...', send: 'Enviar',
        attach_file: 'Adjuntar archivo', voice_message: 'Mensaje de voz', emoji: 'Emoji',
        create_reel: 'Crear slice', reel_caption: 'Descripción...', allow_comments: 'Permitir comentarios',
        publish: 'Publicar', feed: 'Feed', my_reels: 'Mis', liked_reels: 'Me gusta',
        no_reels: 'Todavía no hay slices', be_first: '¡Sé el primero!',
        voice_call: 'Llamada de voz', video_call: 'Videollamada',
        call_only_private: 'Llamadas solo en chats privados', user_unavailable: 'Usuario no disponible',
        calling: 'Llamando...', connected: 'Conectado', mute: 'Silenciar', unmute: 'Activar sonido',
        close: 'Cerrar', confirm: 'Confirmar', cancel: 'Cancelar', yes: 'Sí', no: 'No',
        ok: 'OK', error: 'Error', success: 'Éxito', loading: 'Cargando...',
        participants: 'Participantes', you: 'Tú', admin: 'admin', owner: 'propietario',
        join: 'Unirse', find_users: 'Buscar', add_to_contacts: 'Añadir a contactos',
        contacts: 'Contactos', no_contacts: 'No hay contactos', global_search: 'Buscar usuarios',
        search_users_placeholder: 'Nombre de usuario', delete_for_me: 'Eliminar para mí',
        delete_for_everyone: 'Eliminar para todos', edit_message: 'Editar', add_reaction: 'Añadir reacción',
        pin_message: 'Fijar', forward_message: 'Reenviar', select_recipients: 'Selecciona destinatarios (máx. 5)',
        max_recipients: 'Máximo 5 destinatarios', typing: 'escribiendo...', recording: 'grabando...',
        sending_photo: 'enviando foto...', no_messages: 'Sin mensajes', next: 'Siguiente', back: 'Atrás'
    },
    de: {
        app_name: 'K Messenger', settings: 'Einstellungen', edit_profile: 'Profil bearbeiten',
        username: 'Benutzername', about_me: 'Über mich', save: 'Speichern',
        notifications: 'Benachrichtigungen', privacy: 'Datenschutz', theme: 'Design',
        language: 'Sprache', storage: 'Speicher', about: 'Über', help: 'Hilfe',
        logout: 'Abmelden', version: 'v1.0', tagline: 'Frische Kommunikation jeden Tag 🥒',
        select_language: 'Sprache auswählen', settings_saved: 'Einstellungen gespeichert',
        profile_updated: 'Profil aktualisiert', enter_username: 'Benutzername eingeben',
        in_development: 'in Entwicklung', phone: 'Telefon', online: 'Online', offline: 'Offline',
        chats: 'Chats', reels: 'Slices', new_chat: 'Chat', new_group: 'Gruppe', new_channel: 'Kanal',
        search_placeholder: '🔍 Chats durchsuchen...', select_chat: 'Wählen Sie einen Chat',
        create_group: 'Gruppe erstellen', create_channel: 'Kanal erstellen',
        group_name: 'Gruppenname', channel_name: 'Kanalname',
        channel_link: 'Link (z.B. meinKanal)', public: 'Öffentlich', private: 'Privat',
        description: 'Beschreibung', members: 'Mitglieder', subscribers: 'Abonnenten',
        add_members: 'Mitglieder hinzufügen', add_members_placeholder: 'Suchen...',
        leave_chat: 'Verlassen', delete_chat: 'Löschen', subscribe: 'Abonnieren',
        unsubscribe: 'Abbestellen', message_placeholder: 'Nachricht...', send: 'Senden',
        attach_file: 'Datei anhängen', voice_message: 'Sprachnachricht', emoji: 'Emoji',
        create_reel: 'Slice erstellen', reel_caption: 'Beschreibung...', allow_comments: 'Kommentare erlauben',
        publish: 'Veröffentlichen', feed: 'Feed', my_reels: 'Meine', liked_reels: 'Gefällt mir',
        no_reels: 'Noch keine Slices', be_first: 'Seien Sie der Erste!',
        voice_call: 'Sprachanruf', video_call: 'Videoanruf',
        call_only_private: 'Anrufe nur in privaten Chats', user_unavailable: 'Benutzer nicht verfügbar',
        calling: 'Ruft an...', connected: 'Verbunden', mute: 'Stumm', unmute: 'Ton an',
        close: 'Schließen', confirm: 'Bestätigen', cancel: 'Abbrechen', yes: 'Ja', no: 'Nein',
        ok: 'OK', error: 'Fehler', success: 'Erfolg', loading: 'Laden...',
        participants: 'Teilnehmer', you: 'Du', admin: 'Admin', owner: 'Besitzer',
        join: 'Beitreten', find_users: 'Finden', add_to_contacts: 'Zu Kontakten hinzufügen',
        contacts: 'Kontakte', no_contacts: 'Keine Kontakte', global_search: 'Benutzer suchen',
        search_users_placeholder: 'Benutzername', delete_for_me: 'Für mich löschen',
        delete_for_everyone: 'Für alle löschen', edit_message: 'Bearbeiten', add_reaction: 'Reaktion hinzufügen',
        pin_message: 'Anheften', forward_message: 'Weiterleiten', select_recipients: 'Empfänger auswählen (max. 5)',
        max_recipients: 'Maximal 5 Empfänger', typing: 'tippt...', recording: 'nimmt auf...',
        sending_photo: 'sendet Foto...', no_messages: 'Keine Nachrichten', next: 'Weiter', back: 'Zurück'
    },
    fr: {
        app_name: 'K Messenger', settings: 'Paramètres', edit_profile: 'Modifier le profil',
        username: "Nom d'utilisateur", about_me: 'À propos de moi', save: 'Enregistrer',
        notifications: 'Notifications', privacy: 'Confidentialité', theme: 'Thème',
        language: 'Langue', storage: 'Stockage', about: 'À propos', help: 'Aide',
        logout: 'Déconnexion', version: 'v1.0', tagline: 'Communication fraîche chaque jour 🥒',
        select_language: 'Choisir la langue', settings_saved: 'Paramètres enregistrés',
        profile_updated: 'Profil mis à jour', enter_username: "Entrez le nom d'utilisateur",
        in_development: 'en développement', phone: 'Téléphone', online: 'En ligne', offline: 'Hors ligne',
        chats: 'Discussions', reels: 'Slices', new_chat: 'Chat', new_group: 'Groupe', new_channel: 'Canal',
        search_placeholder: '🔍 Rechercher des discussions...', select_chat: 'Sélectionnez une discussion',
        create_group: 'Créer un groupe', create_channel: 'Créer un canal',
        group_name: 'Nom du groupe', channel_name: 'Nom du canal',
        channel_link: 'Lien (ex: moncanal)', public: 'Public', private: 'Privé',
        description: 'Description', members: 'Membres', subscribers: 'Abonnés',
        add_members: 'Ajouter des membres', add_members_placeholder: 'Rechercher...',
        leave_chat: 'Quitter', delete_chat: 'Supprimer', subscribe: "S'abonner",
        unsubscribe: 'Se désabonner', message_placeholder: 'Message...', send: 'Envoyer',
        attach_file: 'Joindre un fichier', voice_message: 'Message vocal', emoji: 'Émoji',
        create_reel: 'Créer un slice', reel_caption: 'Légende...', allow_comments: 'Autoriser les commentaires',
        publish: 'Publier', feed: 'Flux', my_reels: 'Mes', liked_reels: 'J\'aime',
        no_reels: 'Pas encore de slices', be_first: 'Soyez le premier !',
        voice_call: 'Appel vocal', video_call: 'Appel vidéo',
        call_only_private: 'Appels uniquement dans les discussions privées',
        user_unavailable: 'Utilisateur indisponible', calling: 'Appel...', connected: 'Connecté',
        mute: 'Muets', unmute: 'Activer le son', close: 'Fermer', confirm: 'Confirmer',
        cancel: 'Annuler', yes: 'Oui', no: 'Non', ok: 'OK', error: 'Erreur', success: 'Succès',
        loading: 'Chargement...', participants: 'Participants', you: 'Vous', admin: 'admin',
        owner: 'propriétaire', join: 'Rejoindre', find_users: 'Trouver',
        add_to_contacts: 'Ajouter aux contacts', contacts: 'Contacts', no_contacts: 'Aucun contact',
        global_search: 'Rechercher des utilisateurs', search_users_placeholder: "Nom d'utilisateur",
        delete_for_me: 'Supprimer pour moi', delete_for_everyone: 'Supprimer pour tous',
        edit_message: 'Modifier', add_reaction: 'Ajouter une réaction', pin_message: 'Épingler',
        forward_message: 'Transférer', select_recipients: 'Sélectionnez les destinataires (max 5)',
        max_recipients: 'Maximum 5 destinataires', typing: 'écrit...', recording: 'enregistrement...',
        sending_photo: 'envoie une photo...', no_messages: 'Aucun message', next: 'Suivant', back: 'Retour'
    },
    it: {
        app_name: 'K Messenger', settings: 'Impostazioni', edit_profile: 'Modifica profilo',
        username: 'Nome utente', about_me: 'Su di me', save: 'Salva',
        notifications: 'Notifiche', privacy: 'Privacy', theme: 'Tema',
        language: 'Lingua', storage: 'Archiviazione', about: 'Informazioni', help: 'Aiuto',
        logout: 'Esci', version: 'v1.0', tagline: 'Comunicazione fresca ogni giorno 🥒',
        select_language: 'Seleziona lingua', settings_saved: 'Impostazioni salvate',
        profile_updated: 'Profilo aggiornato', enter_username: 'Inserisci nome utente',
        in_development: 'in sviluppo', phone: 'Telefono', online: 'Online', offline: 'Offline',
        chats: 'Chat', reels: 'Slices', new_chat: 'Chat', new_group: 'Gruppo', new_channel: 'Canale',
        search_placeholder: '🔍 Cerca chat...', select_chat: 'Seleziona una chat',
        create_group: 'Crea gruppo', create_channel: 'Crea canale',
        group_name: 'Nome del gruppo', channel_name: 'Nome del canale',
        channel_link: 'Link (es. miocanale)', public: 'Pubblico', private: 'Privato',
        description: 'Descrizione', members: 'Membri', subscribers: 'Iscritti',
        add_members: 'Aggiungi membri', add_members_placeholder: 'Cerca...',
        leave_chat: 'Abbandona', delete_chat: 'Elimina', subscribe: 'Iscriviti',
        unsubscribe: 'Annulla iscrizione', message_placeholder: 'Messaggio...', send: 'Invia',
        attach_file: 'Allega file', voice_message: 'Messaggio vocale', emoji: 'Emoji',
        create_reel: 'Crea slice', reel_caption: 'Didascalia...', allow_comments: 'Permetti commenti',
        publish: 'Pubblica', feed: 'Feed', my_reels: 'Miei', liked_reels: 'Mi piace',
        no_reels: 'Nessuno slice ancora', be_first: 'Sii il primo!',
        voice_call: 'Chiamata vocale', video_call: 'Videochiamata',
        call_only_private: 'Chiamate solo in chat private', user_unavailable: 'Utente non disponibile',
        calling: 'Chiamata...', connected: 'Connesso', mute: 'Silenzia', unmute: 'Attiva audio',
        close: 'Chiudi', confirm: 'Conferma', cancel: 'Annulla', yes: 'Sì', no: 'No',
        ok: 'OK', error: 'Errore', success: 'Successo', loading: 'Caricamento...',
        participants: 'Partecipanti', you: 'Tu', admin: 'admin', owner: 'proprietario',
        join: 'Unisciti', find_users: 'Trova', add_to_contacts: 'Aggiungi ai contatti',
        contacts: 'Contatti', no_contacts: 'Nessun contatto', global_search: 'Cerca utenti',
        search_users_placeholder: 'Nome utente', delete_for_me: 'Elimina per me',
        delete_for_everyone: 'Elimina per tutti', edit_message: 'Modifica', add_reaction: 'Aggiungi reazione',
        pin_message: 'Fissa', forward_message: 'Inoltra', select_recipients: 'Seleziona destinatari (max 5)',
        max_recipients: 'Massimo 5 destinatari', typing: 'sta scrivendo...', recording: 'registrazione...',
        sending_photo: 'invio foto...', no_messages: 'Nessun messaggio', next: 'Avanti', back: 'Indietro'
    },
    be: {
        app_name: 'K Messenger', settings: 'Налады', edit_profile: 'Рэдагаваць профіль',
        username: 'Імя карыстальніка', about_me: 'Пра сябе', save: 'Захаваць',
        notifications: 'Апавяшчэнні', privacy: 'Прыватнасць', theme: 'Тэма',
        language: 'Мова', storage: 'Памяць', about: 'Пра праграму', help: 'Дапамога',
        logout: 'Выйсці', version: 'v1.0', tagline: 'Свежая камунікацыя кожны дзень 🥒',
        select_language: 'Абярыце мову', settings_saved: 'Налады захаваны',
        profile_updated: 'Профіль абноўлены', enter_username: 'Увядзіце імя карыстальніка',
        in_development: 'у распрацоўцы', phone: 'Тэлефон', online: 'У сетцы', offline: 'Не ў сетцы',
        chats: 'Чаты', reels: 'Слайсы', new_chat: 'Чат', new_group: 'Група', new_channel: 'Канал',
        search_placeholder: '🔍 Пошук па чатах...', select_chat: 'Абярыце чат',
        create_group: 'Стварыць групу', create_channel: 'Стварыць канал',
        group_name: 'Назва групы', channel_name: 'Назва канала',
        channel_link: 'Спасылка (напрыклад: mychannel)', public: 'Публічны', private: 'Прыватны',
        description: 'Апісанне', members: 'Удзельнікі', subscribers: 'Падпісчыкі',
        add_members: 'Дадаць удзельнікаў', add_members_placeholder: 'Пошук...',
        leave_chat: 'Пакінуць', delete_chat: 'Выдаліць', subscribe: 'Падпісацца',
        unsubscribe: 'Адпісацца', message_placeholder: 'Паведамленне...', send: 'Даслаць',
        attach_file: 'Далучыць файл', voice_message: 'Галасавое паведамленне', emoji: 'Эмодзі',
        create_reel: 'Стварыць слайс', reel_caption: 'Апісанне...', allow_comments: 'Дазволіць каментары',
        publish: 'Апублікаваць', feed: 'Стужка', my_reels: 'Мае', liked_reels: 'Падабаецца',
        no_reels: 'Пакуль няма слайсаў', be_first: 'Будзьце першым!',
        voice_call: 'Галасавы выклік', video_call: 'Відэавыклік',
        call_only_private: 'Выклікі толькі ў прыватных чатах', user_unavailable: 'Карыстальнік недаступны',
        calling: 'Выклік...', connected: 'Падключана', mute: 'Адключыць гук', unmute: 'Уключыць гук',
        close: 'Зачыніць', confirm: 'Пацвердзіць', cancel: 'Адмена', yes: 'Так', no: 'Не',
        ok: 'Добра', error: 'Памылка', success: 'Паспяхова', loading: 'Загрузка...',
        participants: 'Удзельнікі', you: 'Вы', admin: 'адмін', owner: 'уладальнік',
        join: 'Далучыцца', find_users: 'Знайсці', add_to_contacts: 'Дадаць у кантакты',
        contacts: 'Кантакты', no_contacts: 'Няма кантактаў', global_search: 'Пошук карыстальнікаў',
        search_users_placeholder: 'Імя карыстальніка', delete_for_me: 'Выдаліць у мяне',
        delete_for_everyone: 'Выдаліць ва ўсіх', edit_message: 'Рэдагаваць', add_reaction: 'Дадаць рэакцыю',
        pin_message: 'Замацаваць', forward_message: 'Пераслаць', select_recipients: 'Абярыце атрымальнікаў (макс. 5)',
        max_recipients: 'Максімум 5 атрымальнікаў', typing: 'друкуе...', recording: 'запіс...',
        sending_photo: 'адпраўляе фота...', no_messages: 'Няма паведамленняў', next: 'Далей', back: 'Назад'
    },
    uk: {
        app_name: 'K Messenger', settings: 'Налаштування', edit_profile: 'Редагувати профіль',
        username: "Ім'я користувача", about_me: 'Про себе', save: 'Зберегти',
        notifications: 'Сповіщення', privacy: 'Конфіденційність', theme: 'Тема',
        language: 'Мова', storage: "Пам'ять", about: 'Про додаток', help: 'Допомога',
        logout: 'Вийти', version: 'v1.0', tagline: 'Свіже спілкування щодня 🥒',
        select_language: 'Виберіть мову', settings_saved: 'Налаштування збережено',
        profile_updated: 'Профіль оновлено', enter_username: "Введіть ім'я користувача",
        in_development: 'в розробці', phone: 'Телефон', online: 'В мережі', offline: 'Не в мережі',
        chats: 'Чати', reels: 'Слайси', new_chat: 'Чат', new_group: 'Група', new_channel: 'Канал',
        search_placeholder: '🔍 Пошук по чатах...', select_chat: 'Виберіть чат',
        create_group: 'Створити групу', create_channel: 'Створити канал',
        group_name: 'Назва групи', channel_name: 'Назва каналу',
        channel_link: 'Посилання (наприклад: mychannel)', public: 'Публічний', private: 'Приватний',
        description: 'Опис', members: 'Учасники', subscribers: 'Підписники',
        add_members: 'Додати учасників', add_members_placeholder: 'Пошук...',
        leave_chat: 'Покинути', delete_chat: 'Видалити', subscribe: 'Підписатися',
        unsubscribe: 'Відписатися', message_placeholder: 'Повідомлення...', send: 'Надіслати',
        attach_file: 'Прикріпити файл', voice_message: 'Голосове повідомлення', emoji: 'Емодзі',
        create_reel: 'Створити слайс', reel_caption: 'Опис...', allow_comments: 'Дозволити коментарі',
        publish: 'Опублікувати', feed: 'Стрічка', my_reels: 'Мої', liked_reels: 'Подобається',
        no_reels: 'Поки немає слайсів', be_first: 'Будьте першим!',
        voice_call: 'Голосовий дзвінок', video_call: 'Відеодзвінок',
        call_only_private: 'Дзвінки тільки в особистих чатах', user_unavailable: 'Користувач недоступний',
        calling: 'Дзвінок...', connected: 'Підключено', mute: 'Вимкнути звук', unmute: 'Увімкнути звук',
        close: 'Закрити', confirm: 'Підтвердити', cancel: 'Скасувати', yes: 'Так', no: 'Ні',
        ok: 'Добре', error: 'Помилка', success: 'Успішно', loading: 'Завантаження...',
        participants: 'Учасники', you: 'Ви', admin: 'адмін', owner: 'власник',
        join: 'Приєднатися', find_users: 'Знайти', add_to_contacts: 'Додати в контакти',
        contacts: 'Контакти', no_contacts: 'Немає контактів', global_search: 'Пошук користувачів',
        search_users_placeholder: "Ім'я користувача", delete_for_me: 'Видалити у мене',
        delete_for_everyone: 'Видалити у всіх', edit_message: 'Редагувати', add_reaction: 'Додати реакцію',
        pin_message: 'Закріпити', forward_message: 'Переслати', select_recipients: 'Виберіть отримувачів (макс. 5)',
        max_recipients: 'Максимум 5 отримувачів', typing: 'друкує...', recording: 'запис...',
        sending_photo: 'надсилає фото...', no_messages: 'Немає повідомлень', next: 'Далі', back: 'Назад'
    },
    pl: {
        app_name: 'K Messenger', settings: 'Ustawienia', edit_profile: 'Edytuj profil',
        username: 'Nazwa użytkownika', about_me: 'O mnie', save: 'Zapisz',
        notifications: 'Powiadomienia', privacy: 'Prywatność', theme: 'Motyw',
        language: 'Język', storage: 'Pamięć', about: 'O aplikacji', help: 'Pomoc',
        logout: 'Wyloguj', version: 'v1.0', tagline: 'Świeża komunikacja każdego dnia 🥒',
        select_language: 'Wybierz język', settings_saved: 'Ustawienia zapisane',
        profile_updated: 'Profil zaktualizowany', enter_username: 'Wprowadź nazwę użytkownika',
        in_development: 'w rozwoju', phone: 'Telefon', online: 'Online', offline: 'Offline',
        chats: 'Czaty', reels: 'Slices', new_chat: 'Czat', new_group: 'Grupa', new_channel: 'Kanał',
        search_placeholder: '🔍 Szukaj czatów...', select_chat: 'Wybierz czat',
        create_group: 'Utwórz grupę', create_channel: 'Utwórz kanał',
        group_name: 'Nazwa grupy', channel_name: 'Nazwa kanału',
        channel_link: 'Link (np. mojkanal)', public: 'Publiczny', private: 'Prywatny',
        description: 'Opis', members: 'Członkowie', subscribers: 'Subskrybenci',
        add_members: 'Dodaj członków', add_members_placeholder: 'Szukaj...',
        leave_chat: 'Opuść', delete_chat: 'Usuń', subscribe: 'Subskrybuj',
        unsubscribe: 'Anuluj subskrypcję', message_placeholder: 'Wiadomość...', send: 'Wyślij',
        attach_file: 'Załącz plik', voice_message: 'Wiadomość głosowa', emoji: 'Emoji',
        create_reel: 'Utwórz slice', reel_caption: 'Opis...', allow_comments: 'Zezwól na komentarze',
        publish: 'Opublikuj', feed: 'Feed', my_reels: 'Moje', liked_reels: 'Polubione',
        no_reels: 'Brak slice\'ów', be_first: 'Bądź pierwszy!',
        voice_call: 'Połączenie głosowe', video_call: 'Połączenie wideo',
        call_only_private: 'Połączenia tylko w prywatnych czatach', user_unavailable: 'Użytkownik niedostępny',
        calling: 'Dzwonienie...', connected: 'Połączono', mute: 'Wycisz', unmute: 'Włącz dźwięk',
        close: 'Zamknij', confirm: 'Potwierdź', cancel: 'Anuluj', yes: 'Tak', no: 'Nie',
        ok: 'OK', error: 'Błąd', success: 'Sukces', loading: 'Ładowanie...',
        participants: 'Uczestnicy', you: 'Ty', admin: 'admin', owner: 'właściciel',
        join: 'Dołącz', find_users: 'Znajdź', add_to_contacts: 'Dodaj do kontaktów',
        contacts: 'Kontakty', no_contacts: 'Brak kontaktów', global_search: 'Szukaj użytkowników',
        search_users_placeholder: 'Nazwa użytkownika', delete_for_me: 'Usuń dla mnie',
        delete_for_everyone: 'Usuń dla wszystkich', edit_message: 'Edytuj', add_reaction: 'Dodaj reakcję',
        pin_message: 'Przypnij', forward_message: 'Przekaż', select_recipients: 'Wybierz odbiorców (max 5)',
        max_recipients: 'Maksymalnie 5 odbiorców', typing: 'pisze...', recording: 'nagrywa...',
        sending_photo: 'wysyła zdjęcie...', no_messages: 'Brak wiadomości', next: 'Dalej', back: 'Wstecz'
    }
};

var currentLanguage = localStorage.getItem('kukumber_language') || 'ru';

function applyTranslations() {
    var t = translations[currentLanguage];
    if (!t) return;
    
    // Заголовок настроек
    var settingsHeader = document.querySelector('#settings-tab .settings-header h2');
    if (settingsHeader) settingsHeader.textContent = t.settings;
    
    // Нижняя навигация
    var navChats = document.querySelector('#nav-chats .nav-label');
    var navReels = document.querySelector('#nav-reels .nav-label');
    var navSettings = document.querySelector('#nav-settings .nav-label');
    if (navChats) navChats.textContent = t.chats;
    if (navReels) navReels.textContent = t.reels;
    if (navSettings) navSettings.textContent = t.settings;
    
    // Поиск в чатах
    var searchInput = document.querySelector('#search-chats');
    if (searchInput) searchInput.placeholder = t.search_placeholder;
    
    // Кнопки создания в чатах
    var chatBtns = document.querySelectorAll('.create-buttons .btn-create span:last-child');
    if (chatBtns[0]) chatBtns[0].textContent = t.new_chat;
    if (chatBtns[1]) chatBtns[1].textContent = t.new_group;
    if (chatBtns[2]) chatBtns[2].textContent = t.new_channel;
    if (chatBtns[3]) chatBtns[3].textContent = t.find_users;
    
    // Сообщение "Выберите чат"
    var noChat = document.querySelector('#no-chat-selected h2');
    if (noChat) noChat.textContent = t.select_chat;
    
    // Поле ввода сообщения
    var messageInput = document.querySelector('#message-input');
    if (messageInput) messageInput.placeholder = t.message_placeholder;
    
    // Заголовок Slices
    var reelsHeader = document.querySelector('#reels-tab .slices-header h2');
    if (reelsHeader) reelsHeader.textContent = t.reels;
    
    // Кнопка создания слайса
    var createReelBtn = document.querySelector('.btn-create-slice');
    if (createReelBtn) createReelBtn.innerHTML = '+ ' + t.create_reel;
    
    // Настройки - пункты меню
    var menuItems = document.querySelectorAll('#settings-tab .settings-section .settings-item');
    var menuLabels = [t.notifications, t.privacy, t.theme, t.language, t.storage, t.about, t.help, t.logout];
    for (var i = 0; i < menuItems.length && i < menuLabels.length; i++) {
        var span = menuItems[i].querySelector('span:nth-child(2)');
        if (span) span.textContent = menuLabels[i];
    }
    
    // Футер настроек
    var footer = document.querySelector('#settings-tab .settings-footer');
    if (footer) {
        var firstP = footer.querySelector('p:first-child');
        var lastP = footer.querySelector('p:last-child');
        if (firstP) firstP.textContent = t.app_name;
        if (lastP) lastP.textContent = t.tagline;
    }
    
    // Кнопка выхода
    var logoutItem = document.querySelector('#settings-tab .settings-item.danger span:nth-child(2)');
    if (logoutItem) logoutItem.textContent = t.logout;
    
    // Модальные окна
    updateModalTexts();
}

function showLanguageSettings() {
    var t = translations[currentLanguage];
    
    var langCodes = {
        ru: 'Русский', en: 'English', es: 'Español', de: 'Deutsch', fr: 'Français',
        it: 'Italiano', be: 'Беларуская', uk: 'Українська', pl: 'Polski'
    };
    
    var langList = '';
    for (var code in langCodes) {
        var isSelected = (code === currentLanguage);
        langList += '<div class="user-item" onclick="setLanguage(\'' + code + '\')" style="justify-content:space-between; cursor:pointer;">' +
            '<span>' + (isSelected ? '✓ ' : '') + langCodes[code] + '</span>' +
            '<span style="color:var(--forest);">' + (isSelected ? '✓' : '→') + '</span>' +
        '</div>';
    }
    
    var oldModal = document.getElementById('language-modal');
    if (oldModal) oldModal.remove();
    
    var modal = document.createElement('div');
    modal.id = 'language-modal';
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-content">' +
        '<div class="modal-header"><h3>' + (t?.select_language || 'Выберите язык') + '</h3><button onclick="closeLanguageModal()" class="btn-close">×</button></div>' +
        '<div class="users-list" style="max-height:70vh;">' + langList + '</div>' +
    '</div>';
    document.body.appendChild(modal);
    modal.classList.remove('hidden');
}

function closeLanguageModal() {
    var modal = document.getElementById('language-modal');
    if (modal) modal.remove();
}

function setLanguage(langCode) {
    if (translations[langCode]) {
        currentLanguage = langCode;
        localStorage.setItem('kukumber_language', langCode);
        showNotification((translations[langCode]?.settings_saved || 'Language changed'), 'success');
        closeLanguageModal();
        applyTranslations();
    }
}

function updateModalTexts() {
    var t = translations[currentLanguage];
    if (!t) return;
    
    var editProfileTitle = document.querySelector('#edit-profile-modal .modal-header h3');
    if (editProfileTitle) editProfileTitle.textContent = t.edit_profile;
    
    var editUsername = document.getElementById('edit-username');
    if (editUsername) editUsername.placeholder = t.username;
    
    var editBio = document.getElementById('edit-bio');
    if (editBio) editBio.placeholder = t.about_me;
    
    var saveBtn = document.querySelector('#edit-profile-modal .btn-primary');
    if (saveBtn) saveBtn.textContent = t.save;
}

// ========== ПРОФИЛЬ ==========
function showEditProfileModal() {
    if (!currentUserData) {
        showNotification('Данные пользователя не загружены', 'error');
        return;
    }
    
    var t = translations[currentLanguage];
    
    document.getElementById('edit-profile-modal').classList.remove('hidden');
    document.getElementById('edit-username').value = currentUserData.username || '';
    document.getElementById('edit-usertag').value = (currentUserData.userTag || '').replace('@', '');
    document.getElementById('edit-bio').value = currentUserData.bio || '';
    
    var preview = document.getElementById('edit-avatar-preview');
    if (currentUserData.avatar) {
        preview.style.backgroundImage = 'url(' + currentUserData.avatar + ')';
        preview.style.backgroundSize = 'cover';
        preview.textContent = '';
    } else {
        preview.style.backgroundImage = '';
        preview.textContent = '🥒';
    }
    
    var header = document.querySelector('#edit-profile-modal .modal-header h3');
    if (header) header.textContent = t.edit_profile;
    
    var usernameInput = document.getElementById('edit-username');
    if (usernameInput) usernameInput.placeholder = t.username;
    
    var bioInput = document.getElementById('edit-bio');
    if (bioInput) bioInput.placeholder = t.about_me;
    
    var saveBtn = document.querySelector('#edit-profile-modal .btn-primary');
    if (saveBtn) saveBtn.textContent = t.save;
}

function closeEditProfileModal() {
    document.getElementById('edit-profile-modal').classList.add('hidden');
}

function previewEditAvatar(event) {
    var file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        window.pendingAvatarFile = file;
        var reader = new FileReader();
        reader.onload = function(e) {
            var preview = document.getElementById('edit-avatar-preview');
            if (preview) {
                preview.style.backgroundImage = 'url(' + e.target.result + ')';
                preview.style.backgroundSize = 'cover';
                preview.textContent = '';
            }
        };
        reader.readAsDataURL(file);
    }
}

function saveProfile() {
    var t = translations[currentLanguage];
    var newUsername = document.getElementById('edit-username').value.trim();
    var newUserTagRaw = document.getElementById('edit-usertag').value.trim().toLowerCase();
    var newBio = document.getElementById('edit-bio').value.trim();
    
    if (!newUsername) {
        showNotification(t.enter_username, 'error');
        return;
    }
    
    var updates = { username: newUsername, bio: newBio };
    var oldUserTag = currentUserData.userTag;
    var newUserTag = '@' + newUserTagRaw.replace(/[^a-z0-9_]/g, '');
    
    function saveData(avatarUrl) {
        if (avatarUrl) updates.avatar = avatarUrl;
        
        if (newUserTag !== oldUserTag && newUserTagRaw.length >= 3) {
            database.ref('userTags/' + newUserTag).once('value').then(function(snap) {
                if (snap.exists() && snap.val() !== currentUser.uid) {
                    showNotification('Юзернейм ' + newUserTag + ' уже занят', 'error');
                    return;
                }
                updates.userTag = newUserTag;
                return database.ref('users/' + currentUser.uid).update(updates);
            }).then(function() {
                if (newUserTag !== oldUserTag && oldUserTag) {
                    return database.ref('userTags/' + oldUserTag).remove();
                }
            }).then(function() {
                if (newUserTag !== oldUserTag && newUserTag) {
                    return database.ref('userTags/' + newUserTag).set(currentUser.uid);
                }
            }).then(function() {
                closeEditProfileModal();
                showNotification(t.profile_updated, 'success');
                if (typeof updateUserDisplay === 'function') updateUserDisplay();
                if (currentUserData) {
                    currentUserData.username = newUsername;
                    currentUserData.userTag = newUserTag;
                    currentUserData.bio = newBio;
                    if (avatarUrl) currentUserData.avatar = avatarUrl;
                }
            }).catch(function(err) {
                showNotification('Ошибка: ' + err.message, 'error');
            });
        } else {
            database.ref('users/' + currentUser.uid).update(updates).then(function() {
                closeEditProfileModal();
                showNotification(t.profile_updated, 'success');
                if (typeof updateUserDisplay === 'function') updateUserDisplay();
                if (currentUserData) {
                    currentUserData.username = newUsername;
                    currentUserData.bio = newBio;
                    if (avatarUrl) currentUserData.avatar = avatarUrl;
                }
            }).catch(function(err) {
                showNotification('Ошибка: ' + err.message, 'error');
            });
        }
    }
    
    if (window.pendingAvatarFile) {
        if (typeof uploadToImgBB === 'function') {
            uploadToImgBB(window.pendingAvatarFile).then(function(url) {
                window.pendingAvatarFile = null;
                saveData(url);
            }).catch(function() { saveData(null); });
        } else {
            saveData(null);
        }
    } else {
        saveData(null);
    }
}

// ========== УВЕДОМЛЕНИЯ ==========
var notificationSettings = {
    private: { enabled: true, showText: true, sound: 'classic', soundUrl: 'https://s17.aconvert.com/convert/p3r68-cdx67/wxmml-vgmt8.mp3' },
    groups: { enabled: true, showText: true, sound: 'classic', soundUrl: 'https://s17.aconvert.com/convert/p3r68-cdx67/wxmml-vgmt8.mp3' },
    channels: { enabled: true, showText: true, sound: 'classic', soundUrl: 'https://s17.aconvert.com/convert/p3r68-cdx67/wxmml-vgmt8.mp3' }
};

var soundsList = {
    'classic': { name: 'Классика', url: 'https://s17.aconvert.com/convert/p3r68-cdx67/wxmml-vgmt8.mp3' },
    'bell': { name: 'Колокол', url: 'https://s31.aconvert.com/convert/p3r68-cdx67/tzal6-g8cc5.mp3' },
    'xylophone': { name: 'Ксилофон', url: 'https://s31.aconvert.com/convert/p3r68-cdx67/abjcm-e8f3f.mp3' }
};

function loadNotificationSettings() {
    var saved = localStorage.getItem('k_notification_settings');
    if (saved) {
        try {
            notificationSettings = JSON.parse(saved);
        } catch(e) {}
    }
}

function saveNotificationSettings() {
    localStorage.setItem('k_notification_settings', JSON.stringify(notificationSettings));
}

function showNotificationSettings() {
    var modalHtml = `
        <div id="notifications-settings-modal" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 500px; border-radius: 20px; overflow: hidden;">
                <div class="modal-header">
                    <h3>🔔 Уведомления и звук</h3>
                    <button onclick="closeNotificationSettings()" class="btn-close">×</button>
                </div>
                <div style="padding: 15px;">
                    <div class="notification-category" onclick="openCategorySettings('private')" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--background); border-radius: 16px; margin-bottom: 10px; cursor: pointer;">
                        <span>📱 Личные чаты</span>
                        <span>›</span>
                    </div>
                    <div class="notification-category" onclick="openCategorySettings('groups')" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--background); border-radius: 16px; margin-bottom: 10px; cursor: pointer;">
                        <span>👥 Группы</span>
                        <span>›</span>
                    </div>
                    <div class="notification-category" onclick="openCategorySettings('channels')" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--background); border-radius: 16px; margin-bottom: 10px; cursor: pointer;">
                        <span>📢 Каналы</span>
                        <span>›</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('notifications-settings-modal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('notifications-settings-modal').classList.remove('hidden');
}

function closeNotificationSettings() {
    var modal = document.getElementById('notifications-settings-modal');
    if (modal) modal.remove();
    var categoryModal = document.getElementById('category-settings-modal');
    if (categoryModal) categoryModal.remove();
}

function openCategorySettings(category) {
    closeNotificationSettings();
    
    var categoryNames = { private: 'Личные чаты', groups: 'Группы', channels: 'Каналы' };
    var settings = notificationSettings[category];
    
    var modalHtml = `
        <div id="category-settings-modal" class="modal" style="z-index: 10003;">
            <div class="modal-content" style="max-width: 500px; border-radius: 20px; overflow: hidden;">
                <div class="modal-header">
                    <button onclick="showNotificationSettings()" class="back-btn" style="position: absolute; left: 15px; top: 12px; background: none; border: none; font-size: 20px; cursor: pointer;">←</button>
                    <h3 style="text-align: center;">${categoryNames[category]}</h3>
                    <button onclick="closeNotificationSettings()" class="btn-close">×</button>
                </div>
                <div style="padding: 15px;">
                    <div style="margin-bottom: 20px;">
                        <div class="notification-setting-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                            <div>
                                <div class="notification-setting-label" style="font-weight: 600;">Уведомления</div>
                                <div class="notification-setting-desc" style="font-size: 12px; color: var(--text-muted);">Показывать уведомления</div>
                            </div>
                            <div class="notification-switch ${settings.enabled ? 'active' : ''}" style="width: 44px; height: 24px; background: ${settings.enabled ? 'var(--forest)' : '#ccc'}; border-radius: 24px; position: relative; cursor: pointer;" onclick="toggleNotificationEnabled('${category}')">
                                <div style="position: absolute; width: 20px; height: 20px; background: white; border-radius: 50%; top: 2px; left: ${settings.enabled ? '21px' : '3px'}; transition: left 0.2s;"></div>
                            </div>
                        </div>
                        
                        ${settings.enabled ? `
                            <div class="notification-setting-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border);">
                                <div>
                                    <div class="notification-setting-label" style="font-weight: 600;">Показывать текст</div>
                                    <div class="notification-setting-desc" style="font-size: 12px; color: var(--text-muted);">Содержание сообщения в уведомлении</div>
                                </div>
                                <div class="notification-switch ${settings.showText ? 'active' : ''}" style="width: 44px; height: 24px; background: ${settings.showText ? 'var(--forest)' : '#ccc'}; border-radius: 24px; position: relative; cursor: pointer;" onclick="toggleShowText('${category}')">
                                    <div style="position: absolute; width: 20px; height: 20px; background: white; border-radius: 50%; top: 2px; left: ${settings.showText ? '21px' : '3px'}; transition: left 0.2s;"></div>
                                </div>
                            </div>
                            
                            <div style="margin-top: 15px;">
                                <div style="font-weight: 600; margin-bottom: 10px;">Звук уведомления</div>
                                <div class="sound-picker" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                    ${Object.entries(soundsList).map(([key, sound]) => `
                                        <div class="sound-option ${settings.sound === key ? 'active' : ''}" style="padding: 8px 16px; background: ${settings.sound === key ? 'var(--forest)' : 'var(--background)'}; color: ${settings.sound === key ? 'white' : 'inherit'}; border-radius: 20px; cursor: pointer;" onclick="selectSound('${category}', '${key}')">${sound.name}</div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="reset-notifications" onclick="resetCategorySettings('${category}')" style="text-align: center; padding: 15px; color: var(--error); cursor: pointer; font-weight: 600;">
                        Сбросить настройки
                    </div>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('category-settings-modal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('category-settings-modal').classList.remove('hidden');
}

function toggleNotificationEnabled(category) {
    notificationSettings[category].enabled = !notificationSettings[category].enabled;
    saveNotificationSettings();
    openCategorySettings(category);
}

function toggleShowText(category) {
    notificationSettings[category].showText = !notificationSettings[category].showText;
    saveNotificationSettings();
    openCategorySettings(category);
}

function selectSound(category, soundKey) {
    notificationSettings[category].sound = soundKey;
    notificationSettings[category].soundUrl = soundsList[soundKey].url;
    saveNotificationSettings();
    
    var audio = new Audio(soundsList[soundKey].url);
    audio.volume = 0.3;
    audio.play().catch(e => console.log('Автоплей заблокирован'));
    
    openCategorySettings(category);
}

function resetCategorySettings(category) {
    notificationSettings[category] = { 
        enabled: true, 
        showText: true, 
        sound: 'classic', 
        soundUrl: 'https://s17.aconvert.com/convert/p3r68-cdx67/wxmml-vgmt8.mp3' 
    };
    saveNotificationSettings();
    openCategorySettings(category);
    showNotification('Настройки сброшены', 'success');
}

// ========== ОФОРМЛЕНИЕ ==========
var currentThemeColor = localStorage.getItem('kukumber_theme_color') || 'green';
var nightModeEnabled = localStorage.getItem('kukumber_night_mode') === 'true';

var colorThemes = {
    green: { primary: '#228B22', secondary: '#32CD32', name: 'Зеленый' },
    blue: { primary: '#1E90FF', secondary: '#63B8FF', name: 'Синий' },
    red: { primary: '#DC143C', secondary: '#FF6B6B', name: 'Красный' },
    purple: { primary: '#8A2BE2', secondary: '#BA55D3', name: 'Фиолетовый' },
    orange: { primary: '#FF8C00', secondary: '#FFB347', name: 'Оранжевый' },
    pink: { primary: '#FF69B4', secondary: '#FFB6C1', name: 'Розовый' },
    turquoise: { primary: '#008080', secondary: '#20B2AA', name: 'Бирюзовый' },
    yellow: { primary: '#FFD700', secondary: '#FFA500', name: 'Желтый' }
};

function showThemeSettings() {
    var isMobile = window.innerWidth <= 768;
    
    var modalHtml = `
        <div id="theme-settings-modal" class="modal" style="z-index: 10002;">
            <div class="modal-content" style="max-width: 500px; border-radius: 20px; overflow: hidden;">
                <div class="modal-header">
                    <h3>🎨 Оформление</h3>
                    <button onclick="closeThemeSettings()" class="btn-close">×</button>
                </div>
                <div style="padding: 15px;">
                    <div style="margin-bottom: 20px;">
                        <button id="night-mode-toggle-btn" onclick="toggleNightModeUI()" style="width: 100%; padding: 14px; background: ${nightModeEnabled ? '#2d2d2d' : 'var(--background)'}; border: 2px solid var(--border); border-radius: 16px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            ${nightModeEnabled ? '🌙 Ночной режим (вкл)' : '☀️ Ночной режим (выкл)'}
                        </button>
                    </div>
                    
                    <div style="font-weight: 600; margin-bottom: 15px;">🎨 Цвет темы</div>
                    <div id="themes-grid" style="display: grid; grid-template-columns: repeat(${isMobile ? '3' : '4'}, 1fr); gap: 15px;"></div>
                </div>
            </div>
        </div>
    `;
    
    var oldModal = document.getElementById('theme-settings-modal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('theme-settings-modal').classList.remove('hidden');
    
    renderThemesGrid();
}

function closeThemeSettings() {
    var modal = document.getElementById('theme-settings-modal');
    if (modal) modal.remove();
}

function renderThemesGrid() {
    var container = document.getElementById('themes-grid');
    if (!container) return;
    
    var isMobile = window.innerWidth <= 768;
    container.style.gridTemplateColumns = 'repeat(' + (isMobile ? '3' : '4') + ', 1fr)';
    container.innerHTML = '';
    
    for (var key in colorThemes) {
        var theme = colorThemes[key];
        var isActive = currentThemeColor === key;
        var div = document.createElement('div');
        div.style.cssText = 'background: ' + theme.primary + '; border-radius: 16px; padding: 12px 8px; text-align: center; cursor: pointer; border: 2px solid ' + (isActive ? theme.primary : 'transparent') + '; transition: transform 0.2s;';
        div.onclick = (function(k) { return function() { setSimpleTheme(k); }; })(key);
        div.innerHTML = '<div style="width: 100%; height: 50px; background: ' + theme.secondary + '; border-radius: 10px; margin-bottom: 8px;"></div><span style="font-size: 12px; color: white; font-weight: 500;">' + theme.name + '</span>' + (isActive ? '<div style="color: white; font-size: 14px; margin-top: 4px;">✓</div>' : '');
        container.appendChild(div);
    }
}

function setSimpleTheme(colorKey) {
    currentThemeColor = colorKey;
    localStorage.setItem('kukumber_theme_color', colorKey);
    
    var theme = colorThemes[colorKey];
    document.documentElement.style.setProperty('--forest', theme.primary);
    document.documentElement.style.setProperty('--lime', theme.secondary);
    
    var gradient = 'linear-gradient(135deg, ' + theme.primary + ', ' + theme.secondary + ')';
    document.querySelectorAll('.btn-primary, .send-btn, .btn-create-slice, .wizard-next-btn, .wizard-create-btn').forEach(function(btn) {
        btn.style.background = gradient;
    });
    
    renderThemesGrid();
    showNotification('Тема "' + theme.name + '" применена', 'success');
}

function toggleNightModeUI() {
    nightModeEnabled = !nightModeEnabled;
    localStorage.setItem('kukumber_night_mode', nightModeEnabled);
    applyNightModeToBody();
    
    var btn = document.getElementById('night-mode-toggle-btn');
    if (btn) {
        btn.innerHTML = nightModeEnabled ? '🌙 Ночной режим (вкл)' : '☀️ Ночной режим (выкл)';
    }
    showNotification(nightModeEnabled ? 'Ночной режим включён 🌙' : 'Ночной режим выключен ☀️', 'success');
}

// Замени функцию applyNightModeToBody на эту:
function applyNightModeToBody() {
    if (nightModeEnabled) {
        document.body.classList.add('night-mode');
        document.documentElement.style.setProperty('--background', '#121212');
        document.documentElement.style.setProperty('--text-dark', '#ffffff');
        document.documentElement.style.setProperty('--text-light', '#a0a0a0');
        document.documentElement.style.setProperty('--text-muted', '#808080');
        document.documentElement.style.setProperty('--border', '#2c2c2c');
        document.documentElement.style.setProperty('--sage', '#2a4a2a');
        document.documentElement.style.setProperty('--olive', '#3a5a3a');
    } else {
        document.body.classList.remove('night-mode');
        document.documentElement.style.setProperty('--background', '#f5f7f5');
        document.documentElement.style.setProperty('--text-dark', '#2c3e2c');
        document.documentElement.style.setProperty('--text-light', '#6b8e6b');
        document.documentElement.style.setProperty('--text-muted', '#94a894');
        document.documentElement.style.setProperty('--border', '#d4e4d4');
        document.documentElement.style.setProperty('--sage', '#9DC183');
        document.documentElement.style.setProperty('--olive', '#556B2F');
    }
}

// В initSettings() убери проверку системной темы, просто ставь light:
function initSettings() {
    loadNotificationSettings();
    detectUserLanguage();
    
    // ПРИНУДИТЕЛЬНО СВЕТЛАЯ ТЕМА (nightModeEnabled = false)
    nightModeEnabled = false;
    localStorage.setItem('kukumber_night_mode', 'false');
    applyNightModeToBody();
    
    var savedTheme = localStorage.getItem('kukumber_theme_color');
    if (savedTheme && colorThemes[savedTheme]) {
        currentThemeColor = savedTheme;
        setSimpleTheme(currentThemeColor);
    }
}

// ========== ПРОЧИЕ НАСТРОЙКИ ==========
function showPrivacySettings() {
    showNotification('Конфиденциальность: в разработке', 'info');
}

function showStorageSettings() {
    showNotification('Данные и память: в разработке', 'info');
}

function showAbout() {
    var t = translations[currentLanguage];
    alert(t.app_name + ' ' + (t.version || 'v1.0') + '\n\n' + (t.tagline || 'Свежее общение каждый день 🥒'));
}

function showHelp() {
    showNotification('Помощь: в разработке', 'info');
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function detectUserLanguage() {
    var saved = localStorage.getItem('kukumber_language');
    if (saved && translations[saved]) {
        currentLanguage = saved;
    } else {
        var browserLang = (navigator.language || 'ru').substring(0, 2).toLowerCase();
        var supported = ['ru', 'en', 'es', 'de', 'fr', 'it', 'be', 'uk', 'pl'];
        if (supported.indexOf(browserLang) !== -1 && translations[browserLang]) {
            currentLanguage = browserLang;
        } else {
            currentLanguage = 'ru';
        }
        localStorage.setItem('kukumber_language', currentLanguage);
    }
    applyTranslations();
}

function initSettings() {
    loadNotificationSettings();
    detectUserLanguage();
    applyNightModeToBody();
    var savedTheme = localStorage.getItem('kukumber_theme_color');
    if (savedTheme && colorThemes[savedTheme]) {
        currentThemeColor = savedTheme;
        setSimpleTheme(currentThemeColor);
    }
}

initSettings();
