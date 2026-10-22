# Changelog

All notable changes to the Daggerheart ruleset for LoomVTT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-21

### Added
- **Duality Dice Engine (SRD 2.0)**:
  - Full support for 2d12 action rolls with Hope and Fear die separation.
  - Automatic evaluation of Criticals, Hope advantages, Fear complications, and advantage/disadvantage d6 modifiers.
  - Interactive roll cards in chat with automated target defense checking.
- **Character Sheet (Dark Stone & Gold Theme)**:
  - Diegetic fixed-header layout for combat vitals and scrollable body for character features.
  - Floating side-tabs dock anchored outside the window.
  - Tactile pips for HP, Stress, Hope, and Armor slots with instant click-to-mark.
  - Metallic heater shields for Core Traits (Agility, Strength, Finesse, Instinct, Presence, Knowledge) with zero-clutter corner edit badges.
  - Automated Damage Thresholds (Minor, Major, Severe) calculated from equipped armor and level.
  - Active Loadout management (max 5 Domain Cards) with Vault storage and recall stress costs.
  - In-sheet item creation, editing, and consumable use controls.
- **Adversary & NPC Sheets**:
  - Compact GM HUD featuring Difficulty (DC), Tier, and Role.
  - Horizontally aligned HP and Stress vitals with Damage Thresholds directly below.
  - Direct attack rolls with damage triggers and GM Fear features.
- **Fear Tracker HUD**:
  - Floating, draggable HUD on the canvas for the GM to manage Fear tokens (0-6).
  - Automatically receives Fear whenever players roll with Fear.
- **Damage & Healing Resolution**:
  - Chat card buttons for rolling damage and applying damage or healing directly to targeted tokens.
  - Armor mitigation dialog allowing characters to spend armor slots to downgrade severity (Severe -> Major -> Minor -> None).
  - Healing consumable workflow rolling recovery formulas and clearing marked HP.
- **Complete SRD 2.0 Compendiums**:
  - Pre-packaged SQLite packs for all Classes (13), Subclasses (26), Ancestries (17), Communities (11), Domain Cards (210), Weapons (142), Armors (69), and Items (99).
