import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MainCanvasComponent } from './main-canvas/main-canvas.component';
import {ConfirmationGuard} from "./services/confirmation.guard";

const routes: Routes = [
  {path: '', component: MainCanvasComponent, canDeactivate: [ConfirmationGuard]}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: [ConfirmationGuard]
})
export class AppRoutingModule { }
