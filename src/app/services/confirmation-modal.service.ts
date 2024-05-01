import { Injectable } from '@angular/core';
import {Observable, Subject} from "rxjs";
import {MaskingService} from "./masking.service";

@Injectable({
  providedIn: 'root'
})
export class ConfirmationModalService {

  private confirmationSubject = new Subject<boolean>();
  private modalOpen = false;

  constructor(private maskSvc: MaskingService) {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = '';
    });
  }

  confirm(): Observable<boolean> {
    return this.confirmationSubject.asObservable();
  }

  openModal() {
    this.modalOpen = true;
  }
}
