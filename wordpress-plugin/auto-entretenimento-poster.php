<?php
/**
 * Plugin Name: Auto Entretenimento Poster
 * Description: Busca noticias populares de entretenimento via RSS, gera resumo com IA opcional e publica no WordPress automaticamente.
 * Version: 1.0.0
 * Author: Criatix
 */

if (!defined('ABSPATH')) {
    exit;
}

const AEP_OPTION = 'aep_settings';
const AEP_CRON = 'aep_run_cron';

register_activation_hook(__FILE__, function () {
    if (!wp_next_scheduled(AEP_CRON)) {
        wp_schedule_event(time() + 300, 'hourly', AEP_CRON);
    }
});

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook(AEP_CRON);
});

add_action(AEP_CRON, 'aep_run');

add_action('admin_menu', function () {
    add_options_page('Auto Entretenimento', 'Auto Entretenimento', 'manage_options', 'auto-entretenimento', 'aep_settings_page');
});

add_action('admin_init', function () {
    register_setting('aep_settings_group', AEP_OPTION);
});

function aep_default_settings() {
    return [
        'feed_url' => 'https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=pt-BR&gl=BR&ceid=BR:pt-419',
        'openai_api_key' => '',
        'openai_model' => 'gpt-4o-mini',
        'post_status' => 'draft',
        'posts_per_run' => 3,
    ];
}

function aep_settings() {
    return wp_parse_args(get_option(AEP_OPTION, []), aep_default_settings());
}

function aep_settings_page() {
    $settings = aep_settings();
    if (isset($_POST['aep_run_now']) && check_admin_referer('aep_run_now')) {
        aep_run();
        echo '<div class="notice notice-success"><p>Busca executada. Veja os posts em Posts.</p></div>';
    }
    ?>
    <div class="wrap">
        <h1>Auto Entretenimento Poster</h1>
        <form method="post" action="options.php">
            <?php settings_fields('aep_settings_group'); ?>
            <table class="form-table">
                <tr>
                    <th scope="row">RSS de entretenimento</th>
                    <td><input class="regular-text" name="<?php echo esc_attr(AEP_OPTION); ?>[feed_url]" value="<?php echo esc_attr($settings['feed_url']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row">OpenAI API Key</th>
                    <td><input class="regular-text" type="password" name="<?php echo esc_attr(AEP_OPTION); ?>[openai_api_key]" value="<?php echo esc_attr($settings['openai_api_key']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row">Modelo OpenAI</th>
                    <td><input class="regular-text" name="<?php echo esc_attr(AEP_OPTION); ?>[openai_model]" value="<?php echo esc_attr($settings['openai_model']); ?>"></td>
                </tr>
                <tr>
                    <th scope="row">Status</th>
                    <td>
                        <select name="<?php echo esc_attr(AEP_OPTION); ?>[post_status]">
                            <option value="draft" <?php selected($settings['post_status'], 'draft'); ?>>Rascunho</option>
                            <option value="publish" <?php selected($settings['post_status'], 'publish'); ?>>Publicar direto</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Posts por rodada</th>
                    <td><input type="number" min="1" max="10" name="<?php echo esc_attr(AEP_OPTION); ?>[posts_per_run]" value="<?php echo esc_attr($settings['posts_per_run']); ?>"></td>
                </tr>
            </table>
            <?php submit_button('Salvar configuracoes'); ?>
        </form>
        <form method="post">
            <?php wp_nonce_field('aep_run_now'); ?>
            <p><button class="button button-primary" name="aep_run_now" value="1">Rodar agora</button></p>
        </form>
    </div>
    <?php
}

function aep_run() {
    include_once ABSPATH . WPINC . '/feed.php';
    $settings = aep_settings();
    $rss = fetch_feed($settings['feed_url']);
    if (is_wp_error($rss)) {
        return;
    }

    $items = $rss->get_items(0, intval($settings['posts_per_run']));
    foreach ($items as $item) {
        $link = $item->get_link();
        if (!$link || aep_already_posted($link)) {
            continue;
        }

        $title = wp_strip_all_tags($item->get_title());
        $summary = wp_strip_all_tags($item->get_description());
        $content = aep_make_content($title, $summary, $link, $settings);

        $post_id = wp_insert_post([
            'post_title' => $title,
            'post_content' => $content,
            'post_excerpt' => wp_trim_words($summary, 35),
            'post_status' => sanitize_key($settings['post_status']),
            'post_category' => [],
            'meta_input' => [
                '_aep_source_url' => esc_url_raw($link),
            ],
        ]);

        if ($post_id && !is_wp_error($post_id)) {
            update_post_meta($post_id, '_aep_source_url', esc_url_raw($link));
        }
    }
}

function aep_already_posted($link) {
    $existing = get_posts([
        'post_type' => 'post',
        'post_status' => 'any',
        'meta_key' => '_aep_source_url',
        'meta_value' => esc_url_raw($link),
        'fields' => 'ids',
        'posts_per_page' => 1,
    ]);
    return !empty($existing);
}

function aep_make_content($title, $summary, $link, $settings) {
    if (!empty($settings['openai_api_key'])) {
        $ai = aep_openai($title, $summary, $link, $settings);
        if ($ai) {
            return $ai . '<p><a href="' . esc_url($link) . '" rel="nofollow noopener" target="_blank">Fonte original</a></p>';
        }
    }

    return '<p><strong>' . esc_html($title) . '</strong></p>'
        . '<p>' . esc_html($summary) . '</p>'
        . '<p>Resumo automatico com base em fonte aberta de noticias.</p>'
        . '<p><a href="' . esc_url($link) . '" rel="nofollow noopener" target="_blank">Ler na fonte original</a></p>';
}

function aep_openai($title, $summary, $link, $settings) {
    $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
        'timeout' => 45,
        'headers' => [
            'Authorization' => 'Bearer ' . $settings['openai_api_key'],
            'Content-Type' => 'application/json',
        ],
        'body' => wp_json_encode([
            'model' => $settings['openai_model'],
            'messages' => [
                ['role' => 'system', 'content' => 'Voce e editor de entretenimento. Escreva em portugues do Brasil e nao copie a noticia original.'],
                ['role' => 'user', 'content' => "Crie um post curto em HTML para WordPress.\nTitulo: {$title}\nResumo: {$summary}\nLink: {$link}"],
            ],
            'temperature' => 0.7,
        ]),
    ]);

    if (is_wp_error($response)) {
        return '';
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    return wp_kses_post($body['choices'][0]['message']['content'] ?? '');
}
