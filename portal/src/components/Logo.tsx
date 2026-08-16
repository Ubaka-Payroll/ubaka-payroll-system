import React from 'react'

type LogoProps = {
  className?: string
  title?: string
}

/** Ubaka mark — uses currentColor for theming. */
const Logo: React.FC<LogoProps> = ({ className, title = 'Ubaka' }) => (
  <svg
    className={className}
    width="48"
    height="47"
    viewBox="0 0 48 47"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label={title}
  >
    <title>{title}</title>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 0H35V30H25.6667V8.37209H9.33333V30H0V0Z"
      fill="currentColor"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48 42H13V12H22.3333V33.6279H38.6667V12H48V42Z"
      fill="currentColor"
    />
  </svg>
)

export default Logo
