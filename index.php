<?php
/**
 * Khung trang duy nhất của ứng dụng.
 *
 * Ứng dụng là một trang đơn tự dựng toàn bộ giao diện bằng JavaScript, nên
 * theme không dùng header.php / footer.php của WordPress. Vẫn gọi wp_head()
 * và wp_footer() để các plugin hoạt động bình thường.
 *
 * @package mthouse-baocao
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<?php wp_head(); ?>
</head>
<body <?php body_class( 'mth-baocao' ); ?>>

<a class="skip-link" href="#main"><?php esc_html_e( 'Bỏ qua, tới nội dung chính', 'mthouse-baocao' ); ?></a>

<div id="app" class="app-root"></div>

<div id="toast" class="toast-wrap" role="status" aria-live="polite"></div>
<div id="overlay-root"></div>

<noscript>
	<p style="padding:24px;font:16px/1.5 system-ui">
		<?php esc_html_e( 'Trang này cần bật JavaScript để hoạt động.', 'mthouse-baocao' ); ?>
	</p>
</noscript>

<?php wp_footer(); ?>
</body>
</html>
