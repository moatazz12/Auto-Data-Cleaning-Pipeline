/**
 * ============================================================
 * FICHIER  : register.component.ts
 * COMPOSANT: RegisterComponent
 * ROUTE    : /register
 *
 * RÔLE     : Page d'inscription de l'application.
 *            Affiche un formulaire complet de création de compte
 *            et gère la validation, incluant la confirmation
 *            du mot de passe.
 *
 * FONCTIONNALITÉS :
 *  • Formulaire Réactif avec 7 champs (userName, firstName, lastName,
 *    email, password, confirmPassword, acceptedTerms)
 *  • Validateur personnalisé cross-field : passwordMatchValidator
 *  • Parsing et affichage des erreurs de l'API (ASP.NET Identity)
 *  • Redirection vers /login après inscription réussie
 *  • Exclusion de confirmPassword et acceptedTerms du DTO envoyé au backend
 *
 * PATTERN Angular :
 *  • Custom Validator : Fonction de validation qui compare deux champs
 *    du formulaire (password vs confirmPassword) et retourne une erreur
 *    si les valeurs ne correspondent pas.
 *  • Object Destructuring : { confirmPassword, acceptedTerms, ...registerData }
 *    pour extraire uniquement les champs utiles à l'API.
 * ============================================================
 */
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * RegisterComponent — Composant de la page d'inscription.
 * Implémente OnInit pour construire le formulaire réactif
 * avec son validateur personnalisé de mot de passe.
 */
@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {

  // ─── Formulaire Réactif ────────────────────────────────────────────────────
  /** Groupe de contrôles représentant le RegisterDto + champs UI */
  registerForm!: FormGroup;

  // ─── État de l'interface ───────────────────────────────────────────────────
  /** true = requête en cours → affiche un spinner et désactive le bouton */
  isLoading = false;

  /** Message d'erreur affiché si l'inscription échoue (erreurs API parsées) */
  errorMessage = '';

  /**
   * Constructeur — Injection des dépendances.
   * @param fb          FormBuilder pour la création du formulaire réactif
   * @param authService Service d'authentification (méthode register)
   * @param router      Service Angular de navigation
   */
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) { }

  /**
   * ngOnInit — Initialisation du formulaire réactif.
   * Crée un FormGroup avec tous les champs nécessaires à l'inscription.
   *
   * CHAMPS :
   *  • userName        : obligatoire (identifiant unique de connexion)
   *  • firstName       : obligatoire
   *  • lastName        : obligatoire
   *  • email           : obligatoire + format email valide
   *  • password        : obligatoire + minimum 6 caractères
   *  • confirmPassword : obligatoire (vérifié par passwordMatchValidator)
   *  • acceptedTerms   : doit être true (case à cocher CGU)
   *
   * VALIDATORS DE GROUPE :
   *  • passwordMatchValidator est appliqué au niveau du FormGroup entier
   *    (pas d'un seul champ) pour comparer les deux mots de passe.
   */
  ngOnInit(): void {
    this.registerForm = this.fb.group({
      userName:        ['', Validators.required],
      firstName:       ['', Validators.required],
      lastName:        ['', Validators.required],
      email:           ['', [Validators.required, Validators.email]],
      password:        ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      acceptedTerms:   [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator }); // Validateur cross-champs
  }

  // ─── Validateur Personnalisé ───────────────────────────────────────────────

  /**
   * passwordMatchValidator — Validateur cross-field personnalisé.
   * Vérifie que le champ "password" et "confirmPassword" sont identiques.
   *
   * @param control AbstractControl du FormGroup entier
   * @returns       { passwordMismatch: true } si mismatch, null sinon
   *
   * PATTERN : Ce validateur est injecté au niveau du groupe FormGroup,
   * ce qui lui permet d'accéder à tous les champs via control.get().
   */
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password        = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      // Force l'erreur directement sur le champ confirmPassword pour l'affichage HTML
      control.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null; // Pas d'erreur : les mots de passe correspondent
  }

  // ─── Gestion de la soumission ─────────────────────────────────────────────

  /**
   * onSubmit — Soumission du formulaire d'inscription.
   *
   * FLUX :
   *  1. Vérifie la validité globale du formulaire (y compris le validateur cross-field)
   *  2. Extrait uniquement les champs du RegisterDto via destructuring
   *     (confirmPassword et acceptedTerms ne sont pas envoyés à l'API)
   *  3. Appelle AuthService.register() et s'abonne à l'Observable
   *  4. En cas de succès → redirige vers /login
   *  5. En cas d'erreur → parse la réponse d'erreur ASP.NET Identity et l'affiche
   */
  onSubmit(): void {
    // Valider tout le formulaire (déclenche l'affichage des erreurs si invalide)
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Destructuring : on sépare les champs UI des champs métier (RegisterDto)
    // confirmPassword et acceptedTerms sont utilisés uniquement côté front
    const { confirmPassword, acceptedTerms, ...registerData } = this.registerForm.value;

    // Appel à l'API via le service — Subscriber
    this.authService.register(registerData).subscribe({
      next: () => {
        this.isLoading = false;
        // Inscription réussie : rediriger vers la page de connexion
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        let displayError = "An error occurred during registration.";

        // Parsing des erreurs retournées par ASP.NET Identity
        // Le backend peut renvoyer un tableau d'erreurs ou un objet avec title
        if (err.error) {
          if (typeof err.error === 'string') {
            try {
              const parsed = JSON.parse(err.error);
              if (Array.isArray(parsed)) {
                // Tableau d'objets erreur Identity { description: "..." }
                displayError = parsed.map((e: any) => e.description || e.Description || '').filter(Boolean).join(' • ');
              } else if (parsed.title) {
                displayError = parsed.title;
              }
            } catch (e) {
              displayError = err.error; // String brut en fallback
            }
          } else if (Array.isArray(err.error)) {
            displayError = err.error.map((e: any) => e.description || e.Description || '').filter(Boolean).join(' • ');
          } else if (err.error.title) {
            displayError = err.error.title;
          }
        }

        this.errorMessage = displayError;
        console.error('Register error: ', err);
      }
    });
  }
}
