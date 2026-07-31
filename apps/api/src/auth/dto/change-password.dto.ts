import { Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres.',
  })
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'La nueva contraseña debe incluir al menos una letra y un número.',
  })
  newPassword!: string;
}
