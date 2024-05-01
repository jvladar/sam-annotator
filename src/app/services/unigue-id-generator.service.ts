import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UnigueIdGeneratorService {

  private idCounter: number = 0;

  constructor() {}

  generateUniqueId(): number {
    return ++this.idCounter;
  }
}
