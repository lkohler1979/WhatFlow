import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'wf-sidebar-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatTooltipModule],
  templateUrl: './sidebar-nav.component.html',
  styleUrl: './sidebar-nav.component.scss',
})
export class SidebarNavComponent {
  navItems: NavItem[] = [
    { icon: '📊', label: 'Dashboard', route: '/dashboard' },
    { icon: '💬', label: 'Inbox', route: '/inbox' },
    { icon: '⚡', label: 'Fluxos', route: '/flows' },
    { icon: '📢', label: 'Campanhas', route: '/campaigns' },
    { icon: '👥', label: 'Contatos', route: '/contacts' },
    { icon: '📱', label: 'Instâncias', route: '/instances' },
    { icon: '📈', label: 'Analytics', route: '/analytics' },
  ];
}
