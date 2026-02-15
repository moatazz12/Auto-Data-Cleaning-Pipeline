/**
 * ============================================================
 * FICHIER  : login.component.ts
 * COMPOSANT: LoginComponent
 * ROUTE    : /login
 *
 * RÔLE     : Page d'authentification de l'application.
 *            Affiche un formulaire de connexion et gère
 *            la validation et la soumission.
 *
 * FONCTIONNALITÉS :
 *  • Formulaire Réactif (ReactiveFormsModule) avec validation
 *  • Validation des champs requis (userName, password)
 *  • Appel à AuthService.login() et gestion de la réponse
 *  • Affichage des erreurs de connexion à l'utilisateur
 *  • Redirection vers /dashboard après connexion réussie
 *
 * PATTERN Angular :
 *  • Reactive Forms : Le formulaire est piloté par le code TypeScript
 *    via FormBuilder et FormGroup, permettant une validation centralisée
 *    et un accès facile aux valeurs sans manipuler le DOM.
 *  • Observable + subscribe : La méthode onSubmit() s'abonne
 *    à l'Observable retourné par AuthService.login().
 * ============================================================
 */
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * LoginComponent — Composant de la page de connexion.
 * Implémente OnInit pour initialiser le formulaire réactif
 * après que l'injection de dépendances soit complète.
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  // ─── Formulaire Réactif ────────────────────────────────────────────────────
  /** Groupe de contrôles du formulaire (userName + password) */
  loginForm!: FormGroup;

  // ─── État de l'interface ───────────────────────────────────────────────────
  /** true = requête en cours → affiche un spinner sur le bouton */
  isLoading = false;

  /** Message d'erreur affiché si la connexion échoue (ex: identifiants incorrects) */
  errorMessage = '';

  /**
   * Constructeur — Injection des dépendances.
   * @param fb          FormBuilder pour créer les groupes de contrôles
   * @param authService Service d'authentification (login, logout, isLoggedIn)
   * @param router      Service Angular de navigation
   */
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * ngOnInit — Initialisation du formulaire réactif.
   * Crée le FormGroup avec les champs correspondant au LoginDto :
   *  • userName  : obligatoire
   *  • password  : obligatoire
   *
   * NOTE : L'initialisation est faite ici (ngOnInit) et non dans le
   * constructeur car Angular doit d'abord terminer l'injection
   * de dépendances avant de construire les FormControls.
   */
  ngOnInit(): void {
    this.loginForm = this.fb.group({
      userName: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  // ─── Gestion de la soumission ─────────────────────────────────────────────

  /**
   * onSubmit — Soumission du formulaire de connexion.
   *
   * FLUX :
   *  1. Vérifie que le formulaire est valide (sinon, marque les champs en erreur)
   *  2. Passe isLoading à true (affiche le spinner)
   *  3. Appelle AuthService.login() qui retourne un Observable
   *  4. En cas de succès → redirige vers /dashboard
   *  5. En cas d'erreur → affiche le message d'erreur
   */
  onSubmit(): void {
    // Valider le formulaire avant tout appel réseau
    if (this.loginForm.invalid) {
      // Déclenche l'affichage des erreurs de validation sur tous les champs
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // Extraire les valeurs du formulaire (correspond au LoginDto du backend)
    const loginData = this.loginForm.value;

    // Subscriber : lance la requête et gère la réponse
    this.authService.login(loginData).subscribe({
      next: (res) => {
        this.isLoading = false;
        // Connexion réussie : rediriger vers le tableau de bord
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        // Afficher un message d'erreur générique à l'utilisateur
        this.errorMessage = 'Invalid credentials. Please try again.';
        console.error('Login error: ', err);
      }
    });
  }
}
