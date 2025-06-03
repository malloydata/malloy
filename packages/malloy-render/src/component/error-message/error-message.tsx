import './error-message.css';

export function ErrorMessage(props: {message: string}) {
  return <div class="malloy-error-message">{props.message}</div>;
}
