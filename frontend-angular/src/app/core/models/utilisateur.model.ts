/**
 * ============================================================
 * FICHIER  : utilisateur.model.ts
 * ENTITÉ   : Utilisateur (correspond à la classe Utilisateur
 *            du diagramme de classes UML)
 *
 * RÔLE     : Définit la structure TypeScript de l'utilisateur
 *            tel que renvoyé par l'API .NET (AccountController).
 *
 * CHAMPS   :
 *  • id          → identifiant unique (GUID string côté ASP.NET Identity)
 *  • userName    → nom d'utilisateur (login)
 *  • email       → adresse email
 *  • firstName   → prénom
 *  • lastName    → nom de famille
 *  • createdAt   → date de création du compte
 * ============================================================
 */
export interface Utilisateur {
  id: string;          // GUID généré par ASP.NET Identity
  userName: string;    // Login (utilisé pour afficher le nom)
  email: string;       // Email de connexion
  firstName: string;   // Prénom
  lastName: string;    // Nom de famille
  createdAt: Date;     // Date d'inscription
}

/**
 * Alias de compatibilité — le code existant utilise "User".
 * On garde cet alias pour ne rien casser.
 * Le modèle principal est "Utilisateur" (diagramme de classes).
 */
export type User = Utilisateur;
