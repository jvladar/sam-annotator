## Diplomová práca - Web aplikácia na tvorbu anotácií objektov v obraze pomocou zero-shot detektora
### Návod na inštaláciu a spustenie aplikácie.
#### Spustenie backe-endovej časti aplikácie
- Stiahnutie SAM modelu:
Stiahnuť si SAM model z nasledujúceho odkazu [sam_vit_h.pth](https://dl.fbaipublicfiles.com/segment\_anything/sam\_vit\_h\_4b8939.pth) a stiahnutý súbor následne presunúť do projektu, do priečinku models.
- Inštalácia potrebných knižníc:
Otvorte príkazový riadok a presuňte sa do priečinku kde sa nachádza aplikácia a zadajte príkaz:
```
pip3 install requirements.txt
```
- Zapnutie back-endovej časti aplikácie:
V príkazovom riadku nastavíme miesto aplikácie a zapneme server, vykonáme to nasledovnými príkazmi:
```
set FLASK_APP = app.py 
flask run
```

#### Spustenie frontendovej časti aplikácie
- Uistite sa, že máte nainštalovaný Node.js a npm. Môžete si ich stiahnuť a nainštalovať zo stránky Node.js. Overiť existenciu Node.js a npm si môžete nasledujúcimi príkazmi:
```
npm -v
node -v
```
- Inštalácia Angular CLI:
Otvorte terminál alebo príkazový riadok a zadajte nasledujúci príkaz:
```
npm install -g @angular/cli
```
- Spustenie projektu:
Otvorte príkazový riadok a presuňte sa do priečinku kde sa nachádza aplikácia a zadajte príkaz na spustenie servera.
```
ng serve
```
-  Aplikácia je dostupná na adrese http://localhost:4200

