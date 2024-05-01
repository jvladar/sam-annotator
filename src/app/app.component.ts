import { Component} from '@angular/core';
import {Observable} from "rxjs";
import {ComponentCanDeactivate} from "./services/confirmation.guard";
import {ConfirmationModalService} from "./services/confirmation-modal.service";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements ComponentCanDeactivate {

  title = 'sam-anotator';

  constructor(private confirmationModalService: ConfirmationModalService) {}

  canDeactivate(): Observable<boolean> | boolean {
    this.confirmationModalService.openModal();
    return this.confirmationModalService.confirm();
  }
}
