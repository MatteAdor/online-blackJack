# 👑 Royal Casino Blackjack - Multiplayer LAN

Una versione completa, ultra-grafica e moderna del classico **Blackjack da Casinò**, giocabile direttamente dal browser e pensata per il multiplayer locale (LAN / Wi-Fi).

---

## ✨ Caratteristiche Principali

- **Grafica Casinò di Lusso:**
  - Tavolo semicircolare in panno verde smeraldo con ricami dorati, poggia-braccia in legno di noce e cuoio imbottito.
  - Sabot trasparente (Shoe a 6 mazzi), vassoio degli scarti e vassoio delle fiches del Banco.
  - Carte da gioco vettoriali ad altissima risoluzione con figure nobili (Re, Regine, Fanti) illustrate e dorso dorato damascato.
  - **Animazioni 3D realistiche**: carte che scorrono dal sabot al tavolo, ribaltamento tridimensionale (`rotateY`) della carta coperta del banco e delle carte distribuite.
  - Fiches da casinò tridimensionali ($5, $25, $50, $100, $500, $1000) che si impilano realisticamente nel piatto delle puntate con effetto isometrico e ombre.

- **Audio Procedurale Realistico (Web Audio API):**
  - Generazione audio sintetica al 100%: zero file mp3 esterni da scaricare, nessun problema di CORS o caricamento lento.
  - Suono dello strusciamento e del ribaltamento delle carte, tintinnio nitido delle fiches in ceramica, fanfare di vittoria, arpeggio trionfale per il Blackjack naturale, suoni per sballo e ticchettio timer.

- **Multiplayer LAN & Sistema Lobby:**
  - **Rilevamento IP Automatico:** Il server rileva l'indirizzo IP della tua scheda di rete (es. `10.2.2.152` o `192.168.1.X`) e genera istantaneamente un **QR Code**.
  - **Accesso Istantaneo per Amici e Smartphone:** Chiunque sia collegato alla stessa rete Wi-Fi può puntare la fotocamera del proprio smartphone o aprire il link dal browser per entrare istantaneamente nella stessa partita.
  - **Lista delle Lobby in Tempo Reale:** Elenco di tutti i tavoli aperti, numero di giocatori seduti (es. 2/5), puntata minima e stato della mano.
  - **Tavolo a Più Posti:** Possibilità di scegliere il proprio posto (fino a 5-6 giocatori contemporaneamente allo stesso tavolo) o assistere come spettatore.
  - **Regole Ufficiali Blackjack:**
    - Pagamento Blackjack 3:2.
    - Dealer chiama fino a 16 e sta su tutti i 17.
    - Raddoppio (Double Down).
    - Divisione della mano (Split) per carte dello stesso valore.
    - Assicurazione (Insurance) se il dealer mostra un Asso.
  - **Chat del Tavolo & Reazioni Rapide:** Messaggi in tempo reale con emoji rapide da casinò (🍀, 🥂, 👏, 💰, 🔥).

---

## 🚀 Come Avviare il Gioco

### Metodo 1: Doppio Click (Windows)
Fai semplicemente doppio click sul file:
```
run.bat
```
Questo avvierà il server e aprirà automaticamente il browser predefinito all'indirizzo del casinò.

### Metodo 2: Tramite PowerShell
```powershell
.\start.ps1
```

### Metodo 3: Da riga di comando Python
```bash
py server.py
```

---

## 📱 Come Invitare Amici sulla stessa rete Wi-Fi

1. Quando avvii il server, vedrai a schermo l'indirizzo LAN (ad esempio `http://10.2.2.152:8080`).
2. Nel gioco, premi il pulsante **"📱 Mostra QR Code"** o **"📶 LAN (Condividi)"**.
3. I tuoi amici connessi alla stessa rete Wi-Fi possono:
   - Inquadrare il QR Code con la fotocamera dello smartphone.
   - Oppure digitare l'indirizzo nel browser del loro telefono, tablet o PC.
4. Compariranno immediatamente nella lista delle lobby e potranno sedersi al tuo tavolo!
